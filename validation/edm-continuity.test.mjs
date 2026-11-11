import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTrackBuffer,playlistPosition,musicDynamics} from '../app/public/music.js';
import {performanceStatus} from '../app/club-performances.js';
import {background,extraGuestPlaces} from '../app/visitors.js';
import {edmArea} from '../app/edm-layout.js';
import {strobeSchedule} from '../stage/festival/events.js';
import {strobeAccentCue} from '../app/public/ceiling-lights.js';
process.env.CLUB_LOCAL_TEST='1';process.env.AUTH_URL='https://localhost:18801';
const {playlist}=await import('../app/music.js');
const tracks=playlist(),track=tracks[0];
function buffer(channels,length,sampleRate){
 const data=Array.from({length:channels},()=>new Float32Array(length));
 return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:c=>data[c]};
}
test('loop preserves source samples, excludes the silent outro and wraps the shared beat clock',()=>{
 assert.equal(track.id,'neon-horizon-treblo');assert.equal(track.firstBeat,0);
 assert(Math.abs(track.duration*132/60-448)<1e-8);
 const decoded=buffer(2,208728,1000);
 for(let c=0;c<2;c++){decoded.getChannelData(c).fill(.4);decoded.getChannelData(c).fill(0,204700);}
 const original=decoded.getChannelData(0).slice();
 const loop=prepareTrackBuffer({createBuffer:buffer},decoded,track);
 assert(Math.abs(loop.duration-track.duration)<.001);
 assert.equal(loop.getChannelData(0)[0],0);assert.equal(loop.getChannelData(0).at(-1),0);
 assert(loop.getChannelData(0).at(-10)>.3);assert(loop.getChannelData(0)[10]>.3);
 assert.deepEqual(decoded.getChannelData(0),original);
 const at=playlistPosition(tracks,1000,1000+track.duration*1000+1);
 assert(Math.abs(at.time-.001)<1e-8);assert.equal(at.cycle,1);
});
test('first laser and hologram start at 30/90 seconds without waiting another eight bars',()=>{
 const epoch=1000000;
 const first=performanceStatus(epoch,epoch,tracks).next;
 assert.equal(first.kind,'laser');assert(Math.abs(first.start-epoch-30000)<1);
 const second=performanceStatus(epoch,epoch+60000,tracks).next;
 assert.equal(second.kind,'phoenix');assert(Math.abs(second.start-epoch-90000)<1);
});
test('quiet sections retain moving lights while automatic flash combinations vary',()=>{
 const time=60,level=musicDynamics({track,time}).level;
 assert(level<.55);
 const quiet=strobeAccentCue({beat:time*132/60,bpm:132,playing:true,arrangement:level});
 assert(quiet.gobo>0&&quiet.curtain>0);assert.equal(quiet.fan,0);
 assert(strobeSchedule(2,132).flash);assert(!strobeSchedule(19,132).flash);
 assert(!strobeSchedule(34,132).flash);assert(strobeSchedule(51,132).flash);
 assert(!strobeSchedule(66,132).flash&&!strobeSchedule(83,132).flash);
});
test('unchanged guest count uses visible bar anchors and a base-tier east-table approach',()=>{
 assert.equal(extraGuestPlaces.length,15);
 assert(extraGuestPlaces.every(p=>!(p.x>=-18.25&&p.x<=-8.7&&p.z>18.4)));
 for(let slot=0;slot<3;slot++)for(let t=0;t<78;t+=.5){
  const actor=background(slot,t);assert.equal(edmArea(actor).tier,0);
  assert(actor.x<=16.6+.001);assert(actor.z<20);
 }
 assert(background(0,45).x>15);assert(background(0,45).z<0);
});
