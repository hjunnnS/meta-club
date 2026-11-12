// The channel epoch drives the playlist for late entry, tab return and track changes.
export function playlistPosition(tracks, epoch, now) {
  const valid = tracks.filter((t) => t.until === null || now < Date.parse(t.until));
  const duration = valid.reduce((total, t) => total + t.duration, 0);
  if (!duration) return null;
  const age = Math.max(0, (now - epoch) / 1000);
  let time = age % duration;
  for (const track of valid) {
    if (time < track.duration) return { track, time, phraseTime: time, cycle: Math.floor(age / duration) };
    time -= track.duration;
  }
  return null;
}

export function trackBeat(position, fallbackSeconds) {
  if (!position) return fallbackSeconds * 2;
  const {track, time} = position;
  return (time - (track.firstBeat || 0)) * (track.bpm || 120) / 60;
}

export function musicDynamics(position) {
  const sections=position?.track.energySections;
  if(!sections?.length)return {level:1,bass:1};
  const beat=Math.max(0,trackBeat(position,0)),index=Math.min(sections.length-1,Math.floor(beat/16));
  const progress=Math.min(1,(beat%16)/2),mix=progress*progress*(3-2*progress),previous=sections[Math.max(0,index-1)],current=sections[index];
  const level=previous[0]+(current[0]-previous[0])*mix;
  return {level,bass:previous[1]+(current[1]-previous[1])*mix};
}

// Build an in-memory, whole-phrase loop; the supplied source file stays untouched.
export function prepareTrackBuffer(ctx,decoded,track) {
  if(Math.abs(decoded.duration-(track.sourceDuration??track.duration))>.1)throw Error('Unexpected source duration');
  if(track.loopStart===undefined)return decoded;
  const start=Math.round(track.loopStart*decoded.sampleRate),end=Math.round(track.loopEnd*decoded.sampleRate);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>decoded.length||end<=start||
    Math.abs((end-start)/decoded.sampleRate-track.duration)>.01)throw Error('Invalid music loop range');
  const buffer=ctx.createBuffer(decoded.numberOfChannels,end-start,decoded.sampleRate);
  // A 3ms cosine edge prevents a waveform click without adding a silent outro.
  const edge=Math.min(Math.round(decoded.sampleRate*.003),Math.floor(buffer.length/2));
  for(let c=0;c<decoded.numberOfChannels;c++){
    const samples=buffer.getChannelData(c);samples.set(decoded.getChannelData(c).subarray(start,end));
    for(let i=0;i<edge;i++){
      const gain=(1-Math.cos(Math.PI*i/Math.max(1,edge-1)))/2;
      samples[i]*=gain;samples[samples.length-1-i]*=gain;
    }
  }
  return buffer;
}

export function musicPlayer(notice, playing, failed, {personalTimeline=false,onStart=()=>{},countdownSeconds=0,onCountdown=()=>{}}={}) {
  let personalStarted=false,countdownPending=false;
  let ctx, analyser, frequencies,
    source,
    started = 0,
    offset = 0,
    current = null,
    tracks = [],
    epoch = 0,
    clockOffset = 0;
  let lastFailure;
  function unavailable(message) {
    notice(message);
    if (lastFailure !== message) {
      lastFailure = message;
      failed(message);
    }
  }
  let enabled = false,
    generation = 0,
    pendingId = null,
    rate = 1,
    correctionEnd = 0;
  const cache = new Map();
  function stop() {
    if(countdownPending){countdownPending=false;onCountdown(null);}
    generation++;
    pendingId = null;
    current = null;
    rate = 1;
    if (source) {
      source.stop();
      source.disconnect();
      source = null;
    }
  }
  function position(now) {
    return (
      offset + now - started + Math.max(0, Math.min(now, correctionEnd) - started) * (rate - 1)
    );
  }
  function target() {
    const now = Date.now() + clockOffset;
    return playlistPosition(tracks, epoch, now);
  }
  async function sync() {
    if (!enabled || !epoch || countdownPending) return;
    const next = target();
    if (!next) {
      if (current || pendingId) stop();
      unavailable('사용 권리가 확인된 음원을 기다리는 중입니다.');
      return;
    }
    if (ctx.state !== 'running') {
      unavailable('음악 시작을 눌러 재생을 복구하세요.');
      return;
    }
    if (current === next.track.id && source) {
      if (lastFailure) {
        lastFailure = null;
        notice(next.track.title);
        playing(current);
      }
      // A one-track loop wraps in the audio device, without restarting the buffer.
      const length = source.buffer.duration,
        now = ctx.currentTime;
      const actual = position(now),
        delta = ((((next.time - actual) % length) + 1.5 * length) % length) - length / 2;
      if (Math.abs(delta) < 0.12) return;
      if (Math.abs(delta) < 1) {
        offset = actual;
        started = now;
        rate = 1 + Math.sign(delta) * 0.02;
        correctionEnd = now + Math.abs(delta) / 0.02;
        source.playbackRate.cancelScheduledValues(now);
        source.playbackRate.setValueAtTime(rate, now);
        source.playbackRate.setValueAtTime(1, correctionEnd);
        return;
      }
    }
    if (pendingId === next.track.id) return;
    stop();
    const id = next.track.id,
      ticket = generation;
    pendingId = id;
    try {
      let buffer = cache.get(id);
      if (!buffer) {
        const res = await fetch(next.track.url);
        if (!res.ok) throw Error();
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
        if (ticket !== generation) return;
        buffer = prepareTrackBuffer(ctx,decoded,next.track);
        cache.set(id, buffer);
      }
      if (ticket !== generation) return;
      const firstPersonalStart=personalTimeline&&!personalStarted;
      // Decode first. Independent trials start at the beginning, not at page-load time.
      if(firstPersonalStart){epoch=Date.now();clockOffset=0;}
      const actual = target();
      if (!actual || actual.track.id !== id) {
        pendingId = null;
        return;
      }
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(analyser);
      const lead=firstPersonalStart?Math.max(0,countdownSeconds):0;
      started = correctionEnd = ctx.currentTime+lead;
      offset = actual.time;
      rate = 1;
      source.start(started, offset % buffer.duration);
      if (actual.track.until !== null) {
        const remainingRights = (Date.parse(actual.track.until) - Date.now() - clockOffset) / 1000;
        source.stop(started + Math.max(0, remainingRights));
      }
      current = id;
      pendingId = null;
      lastFailure = null;
      if(firstPersonalStart){
        const audioEpoch=Date.now()+lead*1000+Math.max(0,ctx.outputLatency||ctx.baseLatency||0)*1000;
        if(lead>0){
          countdownPending=true;onCountdown({endsAt:audioEpoch,seconds:lead});
          await new Promise(resolve=>setTimeout(resolve,Math.max(0,audioEpoch-Date.now())));
          if(ticket!==generation)return;
          countdownPending=false;onCountdown(null);
        }
        personalStarted=true;epoch=audioEpoch;onStart(epoch);
      }
      notice(actual.track.title);
      playing(id);
    } catch {
      if (ticket === generation) {
        stop();
        enabled = false;
        unavailable('곡을 열 수 없습니다. 음악 시작을 눌러 다시 시도하세요.');
      }
    }
  }
  return {
    async start() {
      try {
        ctx ??= new AudioContext();
        if (!analyser) {
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = .72;
          frequencies = new Uint8Array(analyser.frequencyBinCount);
          analyser.connect(ctx.destination);
        }
        await ctx.resume();
        enabled = true;
        await sync();
      } catch {
        unavailable('음악을 시작하지 못했습니다. 다시 눌러 주세요.');
      }
    },
    clock(m) {
      clockOffset = m.now - (Date.now() + m.sent) / 2;
      epoch = m.epoch;
      tracks = m.tracks;
      sync();
    },
    tick: sync,
    spectrum() {
      const bands = Array(12).fill(0);
      if (!source || !current || ctx?.state !== 'running' || lastFailure) return bands;
      analyser.getByteFrequencyData(frequencies);
      // Logarithmic bands from bass through treble, measured from the audible source.
      const edges = [1,2,3,5,8,12,18,27,40,60,90,140,256];
      for (let i=0;i<12;i++) {
        let energy=0;
        for(let j=edges[i];j<edges[i+1];j++) energy+=frequencies[j];
        bands[i]=energy/((edges[i+1]-edges[i])*255);
      }
      return bands;
    },
    status(at = performance.now()) {
      const next=target();
      if(countdownPending||!source||!next||current!==next.track.id||ctx?.state!=='running'||lastFailure)return {playing:false};
      const stamp=ctx.getOutputTimestamp?.();
      const audible=stamp&&stamp.contextTime>0
        ? stamp.contextTime+(at-stamp.performanceTime)/1000
        : ctx.currentTime-(ctx.outputLatency||ctx.baseLatency||0)+(at-performance.now())/1000;
      if(audible<started)return {playing:false};
      const raw=position(Math.max(0,Math.min(ctx.currentTime,audible))),length=source.buffer.duration;
      const time=((raw%length)+length)%length;
      const expected=next.cycle*next.track.duration+next.time;
      const totalTime=time+Math.round((expected-time)/length)*length;
      return {playing:true,track:next.track,time,totalTime,
        beat:(totalTime-(next.track.firstBeat||0))*(next.track.bpm||120)/60};
    },
    beat: () => trackBeat(target(), (Date.now() + clockOffset - epoch) / 1000),
    reset() {
      personalStarted=false;
      stop();
      epoch = 0;
      tracks = [];
      cache.clear();
      notice('');
    },
  };
}
