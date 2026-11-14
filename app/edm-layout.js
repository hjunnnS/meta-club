// Presentation anchors shared by the EDM scene, staff, equipment overlays and media wall.
export const edmStage={
  screen:{x:0,y:5.85,z:-17.95,width:12.8*1.42,height:5.3*1.21},
  wingScreens:{widthRatio:.5,heightRatio:.67,angle:Math.PI/6,gap:0,y:7.95},
  booth:{x:0,z:-15.6},dj:{x:0,y:1.35,z:-16.05},
  focusOrigins:[[-1.8,3.85,-13.10],[2.4,3.5,-13.50],[1.2,5.1,-17.15]],
};
// Keep the reduced area; join the rear edge directly to the DJ booth frontage.
export const edmFloor={width:17.5*Math.sqrt(1.3*.9),depth:17*Math.sqrt(1.3*.9),minZ:edmStage.booth.z+.825};
edmFloor.maxZ=edmFloor.minZ+edmFloor.depth;edmFloor.centerZ=(edmFloor.minZ+edmFloor.maxZ)/2;
export const edmBalcony={
  pockets:[
    {x:-20.5,z:-10.7,fx:1,fz:0,label:'왼쪽 1번 테이블'},
    {x:-20.5,z:-7.9,fx:1,fz:0,label:'왼쪽 2번 테이블'},
    {x:-2.1,z:19.2,fx:0,fz:-1,label:'출입구 위 1번 테이블'},
    {x:2.1,z:19.2,fx:0,fz:-1,label:'출입구 위 2번 테이블'},
    {x:20.5,z:-10.7,fx:-1,fz:0,label:'오른쪽 1번 테이블'},
    {x:20.5,z:-7.9,fx:-1,fz:0,label:'오른쪽 2번 테이블'},
  ]
};
export function edmStairRoute(from,side){
  const route=[[16.7,0,9.5],[18.275,0,9.5],[18.275,0,8.8],[18.275,2,5.0],
    [20.125,2,5.0],[20.125,4,9.5],[16.7,4,9.5]].map(([x,y,z])=>({x:side*x,y,z}));
  let nearest=0,best=Infinity;
  // Ground approaches always start in the central aisle. Mid-flight reconnections
  // choose the nearest point on the remaining ascent rather than teleporting.
  if(from.y>.2)for(let i=1;i<route.length;i++){
    const p=route[i],d=Math.hypot(from.x-p.x,from.z-p.z,(from.y-p.y)*2);
    if(d<best){best=d;nearest=i;}
  }
  return route.slice(nearest);
}
export const edmUpperPath=[[-17,-10.7],[-17,-7.9],[-16.7,-5.5],[-16.7,9.5],[-16.7,18.4],
  [-5,18.4],[-4.2,15.6],[4.2,15.6],[5,18.4],[16.7,18.4],[16.7,9.5],[16.7,-5.5],[17,-7.9],[17,-10.7]]
  .map(([x,z])=>({x,y:4,z}));
export function edmUpperRoute(from,area){
  const nearest=p=>edmUpperPath.reduce((best,q,i)=>Math.hypot(p.x-q.x,p.z-q.z)<Math.hypot(p.x-edmUpperPath[best].x,p.z-edmUpperPath[best].z)?i:best,0);
  const start=nearest(from),p=typeof area==='number'?edmBalcony.pockets[area]:area;if(!p)return [];
  const end=nearest(typeof area==='number'?{x:p.x+p.fx*2.95,z:p.z+p.fz*2.95}:p),direction=Math.sign(end-start);
  if(!direction)return [edmUpperPath[end]];
  const route=[];for(let i=start;;i+=direction){route.push(edmUpperPath[i]);if(i===end)break;}return route;
}
// Foot positions in the approved festival GLB (stage/build.py): metres, Y up.
export function edmCameraDistance(target,direction,length) {
  const margin=.48;
  const entryView=target.z>19.7&&Math.abs(target.x)<3.5;
  const inside=(x,y,z)=>{
    const arena=Math.abs(x)<=21.7-margin&&z>=-20.7+margin&&z<=20.7-margin&&Math.abs(x)+Math.abs(z)<=38.9-margin*1.42;
    const entry=entryView&&Math.abs(x)<=3.5-margin&&z>=19.7&&z<=26.4-margin;
    if(target.y>3.5&&Math.abs(x)>15.2&&z< -12.1)return false;
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
  const ax=Math.abs(x);
  const stair=(ax>=17.6&&ax<=20.8&&z>=4.2&&z<=8.8&&y>=-.1&&y<=4.2)||
    (ax>=15.8&&ax<=18.95&&z>=8.8&&z<=10.1&&y<.3);
  if(stair||upperRect(-20.8,-15.8,-12.2,18.4)||upperRect(15.8,20.8,-12.2,18.4)||
    upperRect(-21.4,-15.8,-12.2,-6.4)||upperRect(15.8,21.4,-12.2,-6.4)||
    upperRect(-4.2,4.2,14.8,20.2)||upperRect(-20,20,16.6,20.2))return {tier:2,group:'u-lounge'};
  // The reclaimed east-wall sofa row and its open aisle remain accessible.
  if (x >= 16.1 && z >= -19 && z <= 19 && y >= -.08 && y < .7)
    return { tier: 0, group: 'east-tables' };
  // The former east dance pad was removed: its ground-level approach to the
  // tables is base space too, rather than an invisible expansion gate.
  if (x < -edmFloor.width/2-.4 && octagon(dx, Math.abs(z - 6), 5.1, 5.5, 1.6))
    return { tier: 1, group: 'west-dance' };
  let group = 'arena';
  if (z > 20.5) group = 'entry';
  else if (Math.abs(x)<=edmFloor.width/2&&z>=edmFloor.minZ&&z<=edmFloor.maxZ) group = 'dancefloor';
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
  return {x,y:.44,z:15.15,yaw:-Math.atan2(-x,28.65)};
});
for (const [i,z] of [16.6,12.2,1.0,-3.4,-10.2,-14.6].entries()) {
  for (const [x,dz,yaw] of [[20.05,0,-Math.PI/2],[18.55,1.65,Math.PI],[18.55,-1.65,0]])
    edmSeats.push({x,y:.10,z:z+dz,yaw,table:i+1,exit:{x:16.6,y:0,z:z+dz,yaw:-Math.PI/2}});
}
// Six upper table groups; three usable seats per sofa group.
for(const [area,p]of edmBalcony.pockets.entries())for(const [place,v]of [-.72,0,.72].entries()){
  const sx=-p.fz,sz=p.fx,x=p.x+p.fx*.06+sx*v,z=p.z+p.fz*.06+sz*v;
  edmSeats.push({x,y:4.02,z,yaw:Math.atan2(-p.fx,-p.fz),balcony:true,area,
    label:'2층 '+p.label+' 소파 · 좌석 '+(place+1),
    exit:{x:p.x+p.fx*2.95,y:4,z:p.z+p.fz*2.95,yaw:Math.atan2(-p.fx,-p.fz)}});
}
export function nearbyEdmSeats(actor) {
  if (!actor) return [];
  return edmSeats.map((seat,index)=>({seat,index,distance:Math.hypot(actor.x-seat.x,actor.z-seat.z)}))
    .filter(({seat,distance})=>distance<(seat.balcony?3.1:seat.table?3.8:2)&&Math.abs(actor.y-seat.y)<.5)
    .sort((a,b)=>a.distance-b.distance);
}

// Only the two physical podiums can host the separate grip dance.
export function nearbyEdmPole(actor,radius=1.65){
  if(!actor||actor.seat!=null||actor.trainSlot!=null||Math.abs(actor.y-.5)>.12)return null;
  const poles=[{x:-15.3,z:-8.8},{x:-15.3,z:-1.6}];
  return poles.find(p=>Math.hypot(actor.x-p.x,actor.z-p.z)<=radius)||null;
}
