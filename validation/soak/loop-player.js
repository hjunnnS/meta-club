// One decoded loop stays on the audio clock. Small clock errors change tempo
// briefly, without skipping samples at the correction or at the loop boundary.
window.createLoopPlayer = async function (wav) {
  const context = new AudioContext();
  const bytes = Uint8Array.from(atob(wav), c => c.charCodeAt(0));
  const buffer = await context.decodeAudioData(bytes.buffer);
  const duration = buffer.duration;
  const wrap = value => ((value % duration) + duration) % duration;
  let source, origin = 0, anchor = 0, rate = 1, until = 0;

  function position(now = context.currentTime) {
    if (!source) return origin;
    const adjusted = Math.max(0, Math.min(now, until) - anchor);
    return wrap(origin + now - anchor + adjusted * (rate - 1));
  }

  function start(offset) {
    if (source) { source.stop(); source.disconnect(); }
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(context.destination);
    anchor = until = context.currentTime;
    origin = wrap(offset);
    rate = 1;
    source.start(anchor, origin);
  }

  return {
    async play() { await context.resume(); if (!source) start(origin); },
    pause() {
      if (!source) return;
      origin = position();
      source.stop(); source.disconnect(); source = null;
    },
    alignAtEntry(offset) { start(offset); },
    get paused() { return !source || context.state !== 'running'; },
    get readyState() { return context.state === 'running' ? 4 : 0; },
    get currentTime() { return position(); },
    set currentTime(target) {
      if (!source) { origin = wrap(target); return; }
      const now = context.currentTime;
      origin = position(now);
      const error = wrap(target - origin + duration / 2) - duration / 2;
      const change = Math.sign(error) * 0.02;
      anchor = now;
      rate = 1 + change;
      until = now + Math.abs(error) / 0.02;
      source.playbackRate.cancelScheduledValues(now);
      source.playbackRate.setValueAtTime(rate, now);
      source.playbackRate.setValueAtTime(1, until);
      window.markAudio?.('correction', { target });
    }
  };
};
