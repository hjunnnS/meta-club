import {edmFloor} from './edm-layout.js';
const x=edmFloor.width/2+.9,front=edmFloor.maxZ+.9,rear=edmFloor.minZ+1;
export const paradeRoute=[[x,front],[-x,front],[-x,rear],[x,rear]];
const lengths=paradeRoute.map((p,i)=>Math.hypot(paradeRoute[(i+1)%4][0]-p[0],paradeRoute[(i+1)%4][1]-p[1]));
const perimeter=lengths.reduce((a,b)=>a+b,0);
export const paradePlan=Object.freeze({seconds:Math.ceil(perimeter/1.8+1),perimeter,fadeIn:.4,fadeOut:.6});
export function paradePose(age,index,seconds=paradePlan.seconds){
 const travel=Math.min(1,Math.max(0,(age-paradePlan.fadeIn)/(seconds-paradePlan.fadeIn-paradePlan.fadeOut)));
 let distance=((travel*perimeter-index*1.1)%perimeter+perimeter)%perimeter,i=0;
 while(distance>lengths[i]&&i<3){distance-=lengths[i];i++;}
 const a=paradeRoute[i],b=paradeRoute[(i+1)%4],next=paradeRoute[(i+2)%4],t=distance/lengths[i];
 const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]),turn=Math.min(1,Math.max(0,(distance-lengths[i]+.75)/.75));
 const nextYaw=Math.atan2(next[0]-b[0],next[1]-b[1]),delta=Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw));
 return {x:a[0]+(b[0]-a[0])*t,y:.018,z:a[1]+(b[1]-a[1])*t,yaw:yaw+delta*turn};
}

// Find the next regular-show gap without reserving or changing any show.
export function nextParadeOpening(now,statusAt,clearance=(paradePlan.seconds+5)*1000){
 let at=now;
 for(let i=0;i<12;i++){
  const {active,next}=statusAt(at);
  if(active){const end=active.start+active.seconds*1000;if(end<=at)return null;at=end;continue;}
  if(next&&next.start-at<clearance){if(next.start<=at)return null;at=next.start;continue;}
  return at;
 }
 return null;
}
