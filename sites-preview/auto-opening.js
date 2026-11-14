// Personal presentation only: visual countdown is independent of autoplay permission.
export function automaticOpening({music,getRoom,frame,showMusic,note,button}){
  let epoch=null,timer=null,disposed=false;
  const cancel=()=>{disposed=true;clearTimeout(timer);};
  window.addEventListener('pagehide',cancel,{once:true});
  return ()=>{
    const room=getRoom();if(!room||disposed)return;
    if(epoch!==null){
      if(Date.now()<epoch)frame('opening-countdown',{endsAt:epoch,seconds:3});
      else frame('visual-track',room.tracks[0]?.id||null);
      return;
    }
    epoch=Date.now()+3000;
    music.followTimeline(epoch);room.startMusic(epoch);
    frame('opening-countdown',{endsAt:epoch,seconds:3});
    button.disabled=true;button.textContent='3·2·1 준비 중';
    timer=setTimeout(async()=>{
      if(disposed)return;
      frame('opening-countdown',null);
      frame('visual-track',room.tracks[0]?.id||null);
      button.disabled=false;
      const started=await music.start({automatic:true});
      if(disposed)return;
      if(!started&&!music.status().playing){showMusic(null);note('음악 시작을 눌러 소리를 켜세요.','music-start');}
    },Math.max(0,epoch-Date.now()));
  };
}
