// Music spectrum plus short whole-room lighting pulses; no sparkle particles.
import {strobeDurations,strobeSchedule,pairedFlash} from '../../stage/festival/events.js';
export {strobeDurations};
export function strobePattern(elapsed, kind = 'transition') {
  if (!Object.hasOwn(strobeDurations,kind) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= strobeDurations[kind]) return 0;
  const ms = Math.floor(elapsed * 1000 + .000001)%7000;
  if (kind === 'normal') {
    // Paired flashes with breathing gaps for the full bar-aligned look.
    return pairedFlash(elapsed);
  }
  if(ms<1000)return Math.floor(ms/250)%2===0?1:0;
  if(ms<2000)return Math.floor((ms-1000)/125)%2===0?1:0;
  if(ms<4000)return Math.floor((ms-2000)/50)%2===0?1:0;
  if(ms<5000)return 0;
  if(ms>=6700)return 1;
  return (ms-5000)%600<200?1:0;
}

export function clubAmbience(B, scene) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  return (beat,values,strobing=false,playing=false,bpm=120,previewAge=null,previewKind='transition',arrangement=1)=>{
    if (strobing || calm.matches) return 0;
    if (previewAge !== null) {
      return strobePattern(previewAge,previewKind);
    }
    if (!playing || arrangement<.55) return 0;
    const bass=((values[0]||0)+(values[1]||0)+(values[2]||0))/3;
    if (bass<.02) return 0;
    // Normal accent halfway through the phrase; the large accent owns its transition.
    const {kind,elapsed,flash}=strobeSchedule(beat,bpm);
    if(!flash)return 0;
    return strobePattern(elapsed,kind)*(.7+.3*bass)*Math.min(1,arrangement);
  };
}
