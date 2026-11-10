import { playlistPosition } from './public/music.js';
export const holograms = ['phoenix','whale','dragon','jellyfish','butterflies'];

function performanceAt(epoch, index, tracks) {
  const due = epoch + (index === 0 ? 30 : 90 + (index - 1) * 120) * 1000;
  const music = playlistPosition(tracks, epoch, due);
  if (!music) return null;
  const bpm = music.track.bpm || 120;
  const beat = ((music.phraseTime ?? music.time) - (music.track.firstBeat || 0)) * bpm / 60;
  const remaining = ((32 - beat % 32) % 32 + 32) % 32;
  // A loop restarts the song's first bar, even when its length is not a full eight-bar phrase.
  const start = due + Math.min(remaining * 60000 / bpm, (music.track.duration - music.time) * 1000);
  const startMusic = playlistPosition(tracks, epoch, start);
  const kind = index % 2 === 0 ? 'laser' : holograms[((index - 1) / 2) % holograms.length];
  return {id:'scheduled-'+index, kind, start, bpm:startMusic?.track.bpm || bpm};
}

// All clients use the channel clock, including the countdown and late joins.
export function performanceStatus(epoch, now, tracks) {
  const age = (now - epoch) / 1000;
  const index = age < 90 ? 0 : 1 + Math.floor((age - 90) / 120);
  const candidates = [...new Set([Math.max(0,index-1),index,index+1])]
    .map(i => performanceAt(epoch,i,tracks)).filter(Boolean);
  const active = candidates.find(e => now >= e.start && now < e.start + (e.kind === 'laser' ? 16 : 14) * 1000) ?? null;
  const next = candidates.find(e => now < e.start) ?? null;
  return {active,next};
}

export function scheduledPerformance(epoch, now, tracks) {
  return performanceStatus(epoch, now, tracks).active;
}
