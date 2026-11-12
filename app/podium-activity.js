// Activity places, not furniture seats: three non-overlapping dance roots per podium.
export const podiumSlots=[-8.8,-1.6].flatMap((z,podium)=>[
  {x:-15.3,y:.5,z:z+.70,podium,pole:{x:-15.3,z}},
  {x:-15.3-.953,y:.5,z:z-.55,podium,pole:{x:-15.3,z}},
  {x:-15.3+.953,y:.5,z:z-.55,podium,pole:{x:-15.3,z}},
].map(p=>({...p,yaw:Math.atan2(p.x+15.3,p.z-z)})));
export function requestPodium(claims,actors,actor,podium,now){
  if(!actor||actor.seat!=null||actor.trainSlot!=null||![0,1].includes(podium))return null;
  for(const [id,claim]of claims)if(claim.until<=now)claims.delete(id);
  const occupied=new Set([...claims].filter(([id])=>id!==actor.id).map(([,c])=>c.slot));
  for(const a of actors)if(a.id!==actor.id&&a.action==='podium-dance')occupied.add(a.podiumSlot);
  const candidates=podiumSlots.map((p,slot)=>({...p,slot})).filter(p=>p.podium===podium&&!occupied.has(p.slot)&&
    !actors.some(a=>a.id!==actor.id&&Math.abs(a.y-.5)<.2&&Math.hypot(a.x-p.x,a.z-p.z)<.68));
  candidates.sort((a,b)=>Math.hypot(actor.x-a.x,actor.z-a.z)-Math.hypot(actor.x-b.x,actor.z-b.z));
  const place=candidates[0];if(!place)return null;
  // Release an abandoned approach automatically; this is not a paid reservation.
  claims.set(actor.id,{slot:place.slot,until:now+60000});return place;
}
export function validPodiumArrival(claims,actor,data,now){
  const claim=claims.get(actor?.id),place=podiumSlots[data?.slot];
  return Boolean(actor&&actor.seat==null&&actor.trainSlot==null&&claim&&claim.until>now&&claim.slot===data?.slot&&place&&
    ['x','y','z','yaw'].every(k=>Number.isFinite(data[k]))&&Math.abs(data.y-.5)<.12&&
    Math.hypot(data.x-place.x,data.z-place.z)<.22&&Math.hypot(data.x-actor.x,data.y-actor.y,data.z-actor.z)<=.5);
}
export function beginPodium(claims,actor,data,beat){
  Object.assign(actor,{x:data.x,y:data.y,z:data.z,yaw:data.yaw,action:'podium-dance',podiumSlot:data.slot,
    podiumSeed:Math.floor(Math.random()*0x7fffffff),podiumStartBeat:Math.ceil(Math.max(0,beat)/4)*4});
  claims.delete(actor.id);
}
export function clearPodium(actor){delete actor.podiumSlot;delete actor.podiumSeed;delete actor.podiumStartBeat;}
function hash(seed,i,salt){let x=(seed^Math.imul(i+1,0x9e3779b1)^salt)|0;x=Math.imul(x^(x>>>16),0x85ebca6b);return (x^(x>>>13))>>>0;}
const routines=new Map();
export function podiumDanceAt(actor,beat,nearPole){
  const key=actor.podiumSeed+':'+nearPole;
  let routine=routines.get(key);
  if(!routine){
    const choices=nearPole?['groove','side-step','disco-point','pole-dance']:['groove','side-step','disco-point'];
    let previous=null,first=null;
    routine=Array.from({length:32},(_,i)=>{
      const available=choices.filter(a=>a!==previous&&(i!==31||a!==first)),action=available[hash(actor.podiumSeed,i,7)%available.length];previous=action;if(i===0)first=action;
      return {action,beats:(4+hash(actor.podiumSeed,i,19)%5)*4};
    });
    if(routines.size>=256)routines.delete(routines.keys().next().value);
    routines.set(key,routine);
  }
  let phase=Math.max(0,beat-(actor.podiumStartBeat||0))%routine.reduce((sum,r)=>sum+r.beats,0);
  for(const r of routine){if(phase<r.beats)return r.action;phase-=r.beats;}
  return 'groove';
}
