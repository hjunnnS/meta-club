// Presentation anchors shared by the EDM scene, staff, equipment overlays and media wall.
export const edmStage={
  screen:{x:0,y:5.85,z:-17.95,width:12.8*1.42,height:5.3*1.21},
  wingScreens:{widthRatio:.5,heightRatio:.67,angle:Math.PI/6,gap:0,y:7.95},
  booth:{x:0,z:-15.6},dj:{x:0,y:1.35,z:-16.05},
  focusOrigins:[[-1.8,3.85,-13.10],[2.4,3.5,-13.50],[1.2,5.1,-17.15]],
};
// Match the west stair and extended upper-deck geometry in stage/build.py.
export const edmBalcony={rampX:-17.9,bottomZ:10,topZ:2,rampHalfWidth:.65,
  rightRamp:{x:10.5,bottomZ:8,topZ:16},
  pockets:[{x:-20.5,z:-12.2,fx:1,fz:0,label:'왼쪽'},{x:0,z:19.2,fx:0,fz:-1,label:'출입구 위'},{x:20.5,z:-12.2,fx:-1,fz:0,label:'오른쪽'}]};
// Connected centerlines keep auto-walking out of the stairwell and away from the wall-side furniture.
export const edmUpperPath=[[-17.9,-13.75],[-17.1,-13.75],[-17.1,-10.65],[-17.9,-10.65],[-17.9,1.2],[-20.4,1.2],[-20.4,11.1],[-17.9,11.1],[-17.9,18.4],[-3,18.4],[-2.1,15.8],[2.1,15.8],[3,18.4],[17.9,18.4],[17.9,-10.65],[17.1,-10.65],[17.1,-13.75],[17.9,-13.75],[10.5,17.3]].map(([x,z])=>({x,y:4,z}));
export function edmUpperRoute(from,area){
  const start=edmUpperPath.reduce((best,p,i)=>Math.hypot(from.x-p.x,from.z-p.z)<Math.hypot(from.x-edmUpperPath[best].x,from.z-edmUpperPath[best].z)?i:best,0);
  const choices=[[1,2],[10,11],[15,16]][area];
  const end=choices.reduce((best,i)=>Math.hypot(from.x-edmUpperPath[i].x,from.z-edmUpperPath[i].z)<Math.hypot(from.x-edmUpperPath[best].x,from.z-edmUpperPath[best].z)?i:best,choices[0]);
  const links=edmUpperPath.map(()=>[]);for(let i=0;i<17;i++){links[i].push(i+1);links[i+1].push(i);}
  for(const i of [12,13]){links[18].push(i);links[i].push(18);}
  const queue=[[start]],seen=new Set([start]);while(queue.length){const path=queue.shift(),at=path.at(-1);if(at===end)return path.map(i=>edmUpperPath[i]);for(const next of links[at])if(!seen.has(next)){seen.add(next);queue.push([...path,next]);}}
  return [];
}
// Foot positions in the approved festival GLB (stage/build.py): metres, Y up.
export function edmCameraDistance(target,direction,length) {
  const margin=.48;
  const entryView=target.z>19.7&&Math.abs(target.x)<3.5;
  const inside=(x,y,z)=>{
    const arena=Math.abs(x)<=21.7-margin&&z>=-20.7+margin&&z<=20.7-margin&&Math.abs(x)+Math.abs(z)<=38.9-margin*1.42;
    const entry=entryView&&Math.abs(x)<=3.5-margin&&z>=19.7&&z<=26.4-margin;
    return y>=.20+margin&&y<=7.7-margin&&(arena||entry);
  };
  for(let d=.08;d<=length+.12;d+=.12) {
    const at=Math.min(d,length);
    if(!inside(target.x+direction.x*at,target.y+direction.y*at,target.z+direction.z*at))return Math.max(.08,at-.18);
    if(at===length)break;
  }
  return length;
}

function octagon(dx, dz, halfWidth, halfDepth, corner) {
  return dx <= halfWidth && dz <= halfDepth && dx + dz <= halfWidth + halfDepth - corner;
}
export function edmArea({ x, y, z }) {
  const dx = Math.abs(Math.abs(x) - 14.6),
    side = x < 0 ? 'west' : 'east';
  const upperRect=(x1,x2,z1,z2)=>y>=3.6&&x>=x1&&x<=x2&&z>=z1&&z<=z2;
  if((Math.abs(x+17.9)<=.65&&z>=2&&z<=10&&Math.abs(y-(4+(z-2)*(.045-4)/8))<.35)||
    (Math.abs(x-10.5)<=.65&&z>=8&&z<=16&&Math.abs(y-(z-8)*.5)<.35)||
    upperRect(-20,-16.2,-14.1,2)||upperRect(-21.2,-19.65,1.2,11.6)||upperRect(-21.2,-16.2,.5,2)||
    upperRect(-21.2,-16.2,10,11.6)||upperRect(-20,-16.2,10,18.4)||upperRect(16.2,20,-14.1,18.4)||
    upperRect(-21.4,-16,-14.1,-10.3)||upperRect(16,21.4,-14.1,-10.3)||upperRect(-2.7,2.7,14.8,20.2)||
    upperRect(9.85,11.15,16,17.6)||(y>=3.6&&octagon(Math.abs(x),Math.abs(z-18.4),20,1.8,1.8)))return {tier:2,group:'u-lounge'};
  // The reclaimed east-wall sofa row and its open aisle remain accessible.
  if (x >= 16.1 && z >= -19 && z <= 19 && y >= -.08 && y < .7)
    return { tier: 0, group: 'east-tables' };
  // The former east dance pad was removed: its ground-level approach to the
  // tables is base space too, rather than an invisible expansion gate.
  if (x < 0 && octagon(dx, Math.abs(z - 6), 5.1, 5.5, 1.6))
    return { tier: 1, group: 'west-dance' };
  let group = 'arena';
  if (z > 20.5) group = 'entry';
  else if (Math.hypot(x, z) <= 8.5) group = 'dancefloor';
  else if (Math.abs(x) <= 7.5 && z < -8) group = 'stage';
  else if (z > 12 && Math.abs(x) > 8) group = x < 0 ? 'bar' : 'lounge';
  return { tier: 0, group };
}

// Check intermediate points too: a sparse update may cut across a gated corner.
export function permittedPath(from, to, states) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / 0.2),
  );
  let previous = edmArea(from).tier;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const { tier } = edmArea({
      x: from.x + (to.x - from.x) * f,
      y: from.y + (to.y - from.y) * f,
      z: from.z + (to.z - from.z) * f,
    });
    if (tier && tier !== previous && states[tier - 1] !== 'OPEN') return false;
    previous = tier;
  }
  return true;
}

// Seat roots match the approved GLB: stool row plus three sofa faces per booth.
export const edmSeats = [-17.6,-15.65,-13.7,-11.75,-9.8].map(oldX=>{
  const x=-27.3-oldX;
  return {x,y:.44,z:14.45,yaw:-Math.atan2(-x,28.65)};
});
for (const [i,z] of [16.6,12,7.4,2.8,-2,-6.8,-11.6,-16.2].entries()) {
  for (const [x,dz,yaw] of [[20.05,0,-Math.PI/2],[18.55,1.65,Math.PI],[18.55,-1.65,0]])
    edmSeats.push({x,y:.10,z:z+dz,yaw,table:i+1,exit:{x:16.6,y:0,z:z+dz,yaw:-Math.PI/2}});
}
// Keep the nine upstairs seat IDs while distributing one sofa group to each compact pocket.
for(const [area,p]of edmBalcony.pockets.entries())for(const [place,v]of [-.72,0,.72].entries()){
  const sx=-p.fz,sz=p.fx,x=p.x+p.fx*.06+sx*v,z=p.z+p.fz*.06+sz*v;
  const exitV=place===0?-1.55:1.55;
  edmSeats.push({x,y:4.02,z,yaw:Math.atan2(-p.fx,-p.fz),balcony:true,area,
    label:'2층 '+p.label+' 소파 · 좌석 '+(place+1),
    exit:{x:p.x+p.fx*1.6+sx*exitV,y:4,z:p.z+p.fz*1.6+sz*exitV,yaw:Math.atan2(-p.fx,-p.fz)}});
}
export function nearbyEdmSeats(actor) {
  if (!actor) return [];
  return edmSeats.map((seat,index)=>({seat,index,distance:Math.hypot(actor.x-seat.x,actor.z-seat.z)}))
    .filter(({seat,distance})=>distance<(seat.balcony?2.4:seat.table?3.8:2)&&Math.abs(actor.y-seat.y)<.5)
    .sort((a,b)=>a.distance-b.distance);
}
