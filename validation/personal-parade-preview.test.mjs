import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {performanceStatus} from '../app/club-performances.js';
import {activityCommands,activityTrialRules} from '../app/club-activities.js';
import {nextParadeOpening,paradePlan} from '../app/parade-plan.js';
registerHooks({resolve(specifier,context,next){
 const routes={'./character-appearance.js':'../app/public/character-appearance.js','./vip-personal-state.js':'../app/vip-personal-state.js','./club-activities.js':'../app/club-activities.js','./parade-plan.js':'../app/parade-plan.js','./wand-customization.js':'../app/public/wand-customization.js','./podium-activity.js':'../app/podium-activity.js','./music.js':'../app/public/music.js','./visitors.js':'../app/visitors.js','./edm-layout.js':'../app/edm-layout.js','./free-dance.js':'../app/public/free-dance.js','./club-performances.js':'../app/club-performances.js','./trial-message-filter.js':'../app/message-filter.js'};
 if(context.parentURL?.includes('/sites-preview/local-room.js')&&routes[specifier])return {url:new URL(routes[specifier],import.meta.url).href,shortCircuit:true};
 if(specifier==='/stage/festival/events.js')return {url:new URL('../stage/festival/events.js',import.meta.url).href,shortCircuit:true};
 if(specifier==='/clubs/edm/edm-layout.js')return {url:new URL('../app/edm-layout.js',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {PersonalRoom}=await import('../sites-preview/local-room.js');
const tracks=[{id:'trial',bpm:132,duration:208.728,until:null,firstBeat:0,url:'/media/trial.mp3'}];
test('first entry is legitimately gated; next regular gap is found without changing shows',()=>{
 const epoch=1000000,statusAt=t=>performanceStatus(epoch,t,tracks),opening=nextParadeOpening(epoch,statusAt);
 assert(opening>epoch+100000&&opening<epoch+110000);const before=statusAt(opening-1);assert(before.active);const ready=statusAt(opening);assert.equal(ready.active,null);assert(ready.next.start-opening>=activityTrialRules.paradeClearance);
 assert.equal(nextParadeOpening(epoch,()=>({active:null,next:null})),epoch);
});
test('personal preview starts immediately despite regular gate, has no cooldown cost, expires and stops independently',()=>{
 const realNow=Date.now;let now=1000000;Date.now=()=>now;const room=new PersonalRoom(tracks),results=[];room.onMessage('activities-result',r=>results.push(r));
 try{room.startMusic(now);const before=room.activities.view(room.sessionId).cooldowns;room.send('vip-start',{requestId:'normal'});assert(results.at(-1).error);assert.equal(room.snapshot().parade,null);
  room.send('vip-preview',{requestId:'preview'});assert(results.at(-1).ok);const started=room.snapshot().parade;assert(started.preview);assert.equal(started.count,5);assert.equal(started.seconds,paradePlan.seconds);assert.deepEqual(room.activities.view(room.sessionId).cooldowns,before);assert.equal(room.activities.snapshot().parade,null);
  room.send('vip-preview',{requestId:'duplicate'});assert(results.at(-1).error);assert.equal(room.snapshot().parade.id,started.id);room.send('vip-start',{requestId:'concurrent'});assert(results.at(-1).error);
  now+=45000;assert.equal(room.snapshot().parade,null);assert.deepEqual(room.activities.view(room.sessionId).cooldowns,before);assert.deepEqual(room.snapshot().stageEvent,performanceStatus(room.epoch,now,tracks).active);
  room.send('vip-preview',{requestId:'again'});assert(results.at(-1).ok);room.send('activities-stop');assert.equal(room.snapshot().parade,null);assert.deepEqual(room.activities.view(room.sessionId).cooldowns,before);
 }finally{room.leave();Date.now=realNow;}
});
test('preview is unavailable during an active regular parade and has no service command bypass',()=>{
 const realNow=Date.now;let now=1000000;Date.now=()=>now;const room=new PersonalRoom(tracks),results=[];room.onMessage('activities-result',r=>results.push(r));
 try{room.startMusic(now);now=nextParadeOpening(now,t=>performanceStatus(room.epoch,t,tracks));room.send('vip-start',{requestId:'normal-start'});assert(results.at(-1).ok);const normal=room.snapshot().parade;assert(!normal.preview);assert(room.activities.view(room.sessionId).cooldowns.paradeUntil>now);
  room.send('vip-preview',{requestId:'during-normal'});assert(results.at(-1).error);assert.equal(room.snapshot().parade.id,normal.id);assert(!activityCommands.includes('vip-preview'));
 }finally{room.leave();Date.now=realNow;}
});

test('incoming whisper trial works without a selected peer and reports blocked attempts',()=>{
 const room=new PersonalRoom(tracks),notifications=[],notices=[];
 room.onMessage('whisper-notification',m=>notifications.push(m));room.onMessage('notice',m=>notices.push(m));
 try{room.send('whisper-demo-incoming',{});assert.equal(notifications.length,1);
  const incoming=notifications[0];assert.equal(incoming.to,room.self.id);assert.equal(incoming.simulated,true);assert.equal(incoming.text,'같이 춤출까요?');assert(room.reactive.some(a=>a.id===incoming.from));assert(notices.at(-1).includes('도착했습니다'));
  room.send('whisper-block',{to:incoming.from});room.send('whisper-demo-incoming',{from:incoming.from});assert.equal(notifications.length,1);assert(notices.at(-1).includes('주고받을 수 없습니다'));
 }finally{room.leave();}
});
