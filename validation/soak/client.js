// Loaded only by the desktop test runner after the EDM scene is ready.
window.startSoak = async function(capacity, warmMs, durationMs) {
  const trial=window.trial, ai=[3,16,29,42,55];
  const slots=Array.from({length:65},(_,i)=>i).filter(i=>!ai.includes(i)).slice(0,capacity);
  const live=new Map([...slots,...ai].map(id=>[id,0]));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const quantile=(a,p)=>a.length?a.slice().sort((x,y)=>x-y)[Math.ceil(a.length*p)-1]:null;
  const rooms=[], received=new Map(), pending=new Map();
  let roomId, clockOffset, epoch, lastBeat=0, musicStarted=false, current=null;
  let finished=false, unexpected=0, contextLoss=0, monitoring=false, bytes=0, inputBytes=0;
  let nextSeq=0, syncAt=0, lastRecovery=null, lateError=null, probeAt=0;
  const music=document.querySelector('#soakMusic');
  const loopError=(a,b)=>Math.abs(((a-b+18000)%12000+12000)%12000-6000);
  const serverTime=()=>Date.now()+clockOffset;
  const danceMs=()=>serverTime()-epoch;
  const drift=()=>loopError(music.currentTime*1000,danceMs()%12000);
  const events=[], buckets=[], visibility=[], rejoins=[];
  function receive(beat){
    lastBeat=performance.now();
    for(const [id,value] of beat.ai)live.set(id,value);
    for(const [actor,seq,sent,variant] of beat.changes){
      live.set(slots[actor],variant);received.set(actor,seq);
      if(actor!==0)pending.set(actor,sent);
    }
    if(current){
      if(beat.members!==capacity||beat.ai.length!==5||!ai.every((id,i)=>beat.ai[i][0]===id))current.badRoster++;
      current.ticks.push(beat.tick);current.beats++;
      bytes+=JSON.stringify(beat).length;
    }
  }
  async function join(actor){
    const client=new Colyseus.Client('ws://127.0.0.1:17352');
    const r=roomId?await client.joinById(roomId,{actor}):await client.create('dance',{actor,capacity});
    roomId=r.roomId;
    r.onMessage('beat',actor===0?receive:()=>{});
    r.onLeave(()=>{if(monitoring&&!finished)unexpected++});
    rooms[actor]=r;return r;
  }
  const observer=await join(0);
  let clockCallback;
  observer.onMessage('clock',msg=>clockCallback?.(msg));
  async function syncClock(){
    const start=Date.now();
    const response=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('clock timeout')),3000);
      clockCallback=m=>{clearTimeout(timeout);resolve(m)};
    });
    observer.send('clock',start);
    const reply=await response;
    clockOffset=reply.now-(start+Date.now())/2;epoch=reply.epoch;
  }
  for(let i=1;i<capacity;i++)await join(i);
  await syncClock();
  // Exercise re-admission before the fixed-occupancy observation window.
  const last=capacity-1;
  for(let i=1;i<=10;i++){
    rooms[last].send('input',{seq:i,sent:performance.now(),variant:i%2});
    for(let j=0;received.get(last)!==i&&j<60;j++)await sleep(25);
    if(received.get(last)!==i)throw Error('preflight input missing');
    const start=performance.now();await rooms[last].leave();
    const r=await join(last);
    const restored=new Promise((resolve,reject)=>{
      const id=setTimeout(()=>reject(Error('restore timeout')),3000);
      r.onMessage('restore',m=>{clearTimeout(id);resolve(m)});
    });
    r.send('restore');const state=await restored;
    if(state?.[1]!==i)throw Error('rejoin lost state');
    rejoins.push(performance.now()-start);
  }
  try {const extra=await new Colyseus.Client('ws://127.0.0.1:17352').joinById(roomId,{actor:capacity});await extra.leave();throw Error('overcapacity admitted');}
  catch(e){if(String(e).includes('overcapacity admitted'))throw e;}
  trial.configureLive(live);
  for(const view of ['floor','deck']){
    trial.setView(view);visibility.push({view,...await trial.visible(.6)});
  }
  monitoring=true;
  document.querySelector('canvas').addEventListener('webglcontextlost',()=>contextLoss++);
  const inputTimer=setInterval(()=>{
    nextSeq++;
    for(let actor=0;actor<capacity;actor++){
      const msg={seq:nextSeq,sent:performance.now(),variant:(Math.floor(nextSeq/12)+actor)%2};
      rooms[actor].send('input',msg);if(current)inputBytes+=JSON.stringify(msg).length;
    }
  },150);
  // Playback has been unlocked by an actual click. Seek to the server epoch.
  await music.play();music.currentTime=(danceMs()%12000)/1000;
  syncAt=performance.now();musicStarted=true;
  const started=performance.now(), measurement=started+warmMs;
  let previous=null, lastBucket=-1, lastView='floor', lastSample=0;
  const step=durationMs<60000?2000:60000;
  function summarize(){
    if(!current)return;
    const {frames,latencies,ticks,errors,...rest}=current;
    buckets.push({...rest,frameCount:frames.length,frameP95:quantile(frames,.95),frameMax:Math.max(...frames),
      remoteP95:quantile(latencies,.95),remoteCount:latencies.length,tickP95:quantile(ticks,.95),
      musicMax:errors.length?Math.max(...errors):null,musicSamples:errors.length,rxBytes:bytes,txBytes:inputBytes,
      heap:performance.memory?.usedJSHeapSize??null});
    current=null;
  }
  const frameHistograms={};
  const result={frameHistograms,roomId,capacity,renderer:trial.renderer,version:trial.version,width:trial.width,height:trial.height,
    wallStart:new Date().toISOString(),rejoins,visibility,buckets,events};
  window.soak={result,status:()=>({measuredSec:(performance.now()-measurement)/1000,buckets:buckets.length,done:finished})};
  function frame(now){
    try{
      const elapsed=now-measurement;
      if(elapsed>=durationMs){
        summarize();finished=true;clearInterval(inputTimer);music.pause();
        Object.assign(result,{unexpected,contextLoss,lateError,lastRecovery,observedActors:received.size,
          actualMs:elapsed,warmMs,durationMs,done:true});
        return;
      }
      const index=Math.floor(elapsed/step);
      const view=(Math.max(0,index)%2===0)?'floor':'deck';
      if(view!==lastView){trial.setView(view);lastView=view}
      if(elapsed>=0&&index!==lastBucket){
        syncClock().catch(e=>{window.soakError=String(e)});
        summarize();lastBucket=index;bytes=0;inputBytes=0;
        current={index,view,frames:[],latencies:[],ticks:[],errors:[],beats:0,badRoster:0,maxSilence:0,stalls:0};
      }
      if(musicStarted&&lateError===null&&now-syncAt>=2750){lateError={ms:drift(),afterMs:now-syncAt};}
      if(elapsed>=0&&!probeAt&&elapsed>=durationMs/2){
        probeAt=now;music.currentTime=((danceMs()+1800)%12000)/1000;
        music.currentTime=(danceMs()%12000)/1000;
      }
      if(probeAt&&!lastRecovery&&now-probeAt>=2750)lastRecovery={ms:drift(),afterMs:now-probeAt};
      if(elapsed<0&&now-lastSample>=250){
        if(drift()>120)music.currentTime=(danceMs()%12000)/1000;
        lastSample=now;
      }
      trial.draw(danceMs()/1000);
      if(current){
        if(previous!==null){
          const interval=now-previous;
          current.frames.push(interval);
          const tenth=Math.round(interval*10);
          for(const group of [view,...(elapsed>=durationMs-300000?['last5-'+view]:[])]){
            const hist=frameHistograms[group]??={};
            hist[tenth]=(hist[tenth]||0)+1;
          }
        }
        for(const sent of pending.values())current.latencies.push(performance.now()-sent);
        current.maxSilence=Math.max(current.maxSilence,performance.now()-lastBeat);
        if(now-lastSample>=250){
          const error=drift();current.errors.push(error);
          if(music.paused||music.readyState<2)current.stalls++;
          if(error>120){music.currentTime=(danceMs()%12000)/1000;events.push({at:elapsed,error});}
          lastSample=now;
        }
      }
      previous=now;pending.clear();requestAnimationFrame(frame);
    }catch(e){window.soakError=String(e)}
  }
  requestAnimationFrame(frame);
};
