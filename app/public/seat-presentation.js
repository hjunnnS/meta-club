import {edmSeats,edmBalcony} from './edm-layout.js';
const tableZ=[16.6,12.2,1.0,-3.4,-10.2,-14.6];
export function tableSeatTarget(hit,actor,occupied){
  if(!hit?.hit||!actor)return null;
  const names=[hit.pickedMesh.name,hit.pickedMesh.parent?.name];
  const upper=names.some(n=>/^VIP (sofa (base|cushion|back|arm|return)|low table top|table leg|table lamp diffuser|back upholstery)$/.test(n));
  const lower=names.some(n=>/^Wall booth (seat|table|back|base|leg|lantern)$/.test(n));
  if(!upper&&!lower)return null;
  const point=hit.pickedPoint;
  let candidates,label;
  if(upper){
    let area=0,best=Infinity;
    edmBalcony.pockets.forEach((p,i)=>{const d=Math.hypot(point.x-p.x-p.fx,point.z-p.z-p.fz);if(d<best){best=d;area=i;}});
    candidates=edmSeats.map((seat,index)=>({seat,index})).filter(s=>s.seat.balcony&&s.seat.area===area);
    label='2층 '+edmBalcony.pockets[area].label;
  }else{
    let table=1,best=Infinity;
    tableZ.forEach((z,i)=>{const d=Math.abs(point.z-z);if(d<best){best=d;table=i+1;}});
    candidates=edmSeats.map((seat,index)=>({seat,index})).filter(s=>s.seat.table===table);
    label=table+'번 테이블';
  }
  const exact=names.some(n=>/^(VIP sofa cushion|Wall booth seat)$/.test(n));
  candidates.sort((a,b)=>exact?Math.hypot(a.seat.x-point.x,a.seat.z-point.z)-Math.hypot(b.seat.x-point.x,b.seat.z-point.z)
    :(Math.hypot(a.seat.exit.x-actor.x,a.seat.exit.z-actor.z)+.08*Math.hypot(a.seat.x-actor.x,a.seat.z-actor.z))-(Math.hypot(b.seat.exit.x-actor.x,b.seat.exit.z-actor.z)+.08*Math.hypot(b.seat.x-actor.x,b.seat.z-actor.z)));
  const found=exact?candidates[0]:candidates.find(s=>!occupied.has(s.index));
  return {index:found&&!occupied.has(found.index)?found.index:-1,exact,label};
}
const smooth=t=>t*t*(3-2*t);
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
// Once the authoritative seat is accepted, present the final approach around the
// low table, turn and sit. The walking map, seat ownership and exit stay unchanged.
export function animateSeatArrival(B,model,actor,now,reduced){
  const motion=actor.seatMotion,seat=edmSeats[actor.seat];
  if(reduced||actor.seat==null||!motion||!seat||motion.seat!==actor.seat)return false;
  const key=motion.at+':'+actor.seat;
  if(model.seatMotionKey!==key){
    const from=motion.from,points=[{...from}];
    const add=(x,z)=>points.push({x,y:from.y,z});
    if(seat.balcony){
      const p=edmBalcony.pockets[seat.area],sx=-p.fz,sz=p.fx;
      const lateral=(seat.x-p.x)*sx+(seat.z-p.z)*sz;
      const point=(u,v)=>add(p.x+p.fx*u+sx*v,p.z+p.fz*u+sz*v);
      // The return end occupies negative lateral space: pass the other end.
      point(2.95,1.25);point(1.0,1.25);point(1.0,lateral);
    }else if(seat.x>19.5){
      const side=from.z<seat.z?-1:1;
      add(17.2,seat.z+side*.98);add(19.35,seat.z+side*.98);add(19.35,seat.z);
    }else{
      const center=tableZ[seat.table-1],toward=Math.sign(center-seat.z);
      add(17.05,seat.z+toward*.65);add(seat.x,seat.z+toward*.65);
    }
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
    model.seatMotionKey=key;model.seatArrival={points,lengths,duration:Math.max(.25,lengths.at(-1)/2.6)};
  }
  const {points,lengths,duration}=model.seatArrival,age=Math.max(0,(now-motion.at)/1000);
  if(age>=duration+.72){model.torso.rotation.x=0;return false;}
  let turn=0;
  if(age<duration){
    const travel=lengths.at(-1)*(1-Math.pow(1-age/duration,1.18));
    let i=1;while(i<lengths.length-1&&lengths[i]<travel)i++;
    const f=Math.min(1,(travel-lengths[i-1])/Math.max(.001,lengths[i]-lengths[i-1]));
    const a=points[i-1],b=points[i];model.root.position.set(a.x+(b.x-a.x)*f,a.y,a.z+(b.z-a.z)*f);
    const heading=Math.atan2(a.x-b.x,a.z-b.z);
    model.root.rotation.y=age<.16?angle(motion.from.yaw,heading,smooth(age/.16)):heading;
  }else{
    turn=smooth(Math.min(1,(age-duration)/.72));
    const end=points.at(-1),before=points.at(-2)||motion.from;
    model.root.position.set(end.x+(actor.x-end.x)*turn,end.y+(actor.y-end.y)*turn,end.z+(actor.z-end.z)*turn);
    model.root.rotation.y=angle(Math.atan2(before.x-end.x,before.z-end.z),actor.yaw,turn);
  }
  model.near.position.set(0,-.32*turn,0);model.near.rotation.setAll(0);model.torso.rotation.z=0;
  model.torso.rotation.x=.12*Math.sin(turn*Math.PI);
  const stride=Math.sin(age*8)*(1-turn);
  model.limbs.forEach((joint,i)=>{const arm=i%2===0,sign=i<2?-1:1;
    joint.rotationQuaternion=null;joint.scaling.y=1;
    joint.rotation.x=arm?-sign*.35*stride:sign*.45*stride-1.1*turn;
    joint.rotation.z=arm?sign*.12:0;
  });
  model.near.setEnabled(true);model.far.setEnabled(false);return true;
}

export function captureSeatDeparture(model,next,now){
 if(model.actor?.seat==null||next.seat!=null)return;
 model.standMotion={at:now,from:{x:model.root.position.x,y:model.root.position.y,z:model.root.position.z,yaw:model.root.rotation.y},to:{x:next.x,y:next.y,z:next.z,yaw:next.yaw}};
}
// Visual rise and a short step to the existing authoritative seat exit.
export function animateSeatDeparture(B,model,actor,now,reduced){
 const motion=model.standMotion;if(!motion)return false;
 if(actor.seat!=null||actor.action==='walk'||reduced){delete model.standMotion;return false;}
 const age=Math.max(0,(now-motion.at)/1000),rise=smooth(Math.min(1,age/.45)),step=smooth(Math.max(0,Math.min(1,(age-.40)/.55)));
 const {from,to}=motion;
 model.root.position.set(from.x+(to.x-from.x)*step,from.y+(to.y-from.y)*step,from.z+(to.z-from.z)*step);
 model.root.rotation.y=angle(from.yaw,to.yaw,step);
 model.near.position.set(0,-.32*(1-rise),0);model.near.rotation.setAll(0);
 model.torso.rotation.set(.18*Math.sin(rise*Math.PI),0,0);
 model.limbs.forEach((joint,i)=>{
  const arm=i%2===0,sign=i<2?-1:1,stride=Math.sin(step*Math.PI*2)*.24;
  joint.rotationQuaternion=null;joint.scaling.y=1;joint.rotation.set(arm?-sign*stride:-1.1*(1-rise)+sign*stride,0,arm?sign*.12:0);
 });
 model.near.setEnabled(true);model.far.setEnabled(false);
 if(age>=.95){model.torso.rotation.x=0;delete model.standMotion;return false;}
 return true;
}
