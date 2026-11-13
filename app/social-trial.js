// Presentation lifetimes, not sale/ownership policies. No charges or consumption.
export const socialDurations=Object.freeze({birthday:15,heart:4,bouquet:8,cake:10});
export function socialTrial(actors,now=()=>Date.now()){
  let sequence=0;const events=new Map();
  const actor=id=>actors().find(a=>a.id===id);
  return {
    add(kind,from,to){
      if(!Object.hasOwn(socialDurations,kind)||!actor(from)||!actor(to))return null;
      const event={id:'social-'+now()+'-'+ ++sequence,kind,from,to,start:now(),seconds:socialDurations[kind]};
      events.set(event.id,event);return {...event};
    },
    stop(who){for(const [id,event]of events)if(event.from===who||event.to===who)events.delete(id);},
    snapshot(){
      for(const [id,event]of events)if(now()>=event.start+event.seconds*1000||!actor(event.from)||!actor(event.to))events.delete(id);
      return [...events.values()].map(e=>({...e}));
    },
  };
}
