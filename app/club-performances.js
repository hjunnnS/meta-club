import { playlistPosition } from './public/music.js';
export const holograms = ['phoenix','whale','dragon','jellyfish','butterflies'];

// Channel epoch is common to late joiners. A missed performance expires instead of queuing.
export function scheduledPerformance(epoch, now, tracks) {
  const age=(now-epoch)/1000;
  if(age<60 || !tracks.length)return null;
  const slot=Math.floor(age/180);
  const dueSeconds=slot===0?60:slot*180;
  const due=epoch+dueSeconds*1000;
  const music=playlistPosition(tracks,epoch,due);
  if(!music)return null;
  const bpm=music.track.bpm||120;
  const beat=((music.phraseTime??music.time)-(music.track.firstBeat||0))*bpm/60;
  const remaining=((32-beat%32)%32+32)%32;
  const start=due+remaining*60000/bpm;
  const kind=slot>0 && slot%2===0?holograms[(slot/2-1)%holograms.length]:'laser';
  if(now<start || now>=start+(kind==='laser'?16:14)*1000)return null;
  return {id:'scheduled-'+slot,kind,start};
}
