import {vipTableAnchor} from './vip-personal-state.js';
export {vipCommands,vipPersonalCommand,vipTableAnchor} from './vip-personal-state.js';
export function animateVipSolo(model,beat,reduced=false){
 const b=reduced?0:Math.max(0,beat),phrase=b%16,w=Math.sin(b*Math.PI),half=Math.sin(b*Math.PI/2);
 const turn=phrase>=8&&phrase<12?(phrase-8)/4:phrase>=12?1:0;
 const smooth=turn*turn*(3-2*turn);
 model.near.position.set(phrase<8?.16*half:0,.045*Math.abs(w),phrase<8?.18*Math.sin(b*Math.PI/2):0);
 model.near.rotation.set(0,smooth*Math.PI*2,.045*w);model.torso.rotation.z=.06*half;
 model.limbs.forEach((j,i)=>{const side=i<2?-1:1,arm=i%2===0;
  j.rotation.set(arm?-.35+side*.24*w:-.12+side*.65*w,0,arm?side*(phrase>=12?1.65:.40+.18*half):side*.07);
 });
}
export function vipPersonalProps(B,scene,model){
 let fan=null,fanInk=null,tower=null,towerKey='',towerInks=[],streams=[];
 const part=(name,kind,options,parent,material,x,y,z)=>{const m=B.MeshBuilder[kind]('VIP personal '+name,options,scene);m.parent=parent;m.position.set(x,y,z);m.material=material;m.isPickable=false;m.checkCollisions=false;return m;};
 const material=(name,color,emission=0)=>{const m=new B.StandardMaterial('VIP personal '+name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(emission);m.specularColor.set(.2,.2,.2);return m;};
 function createFan(){
  fan=new B.TransformNode('VIP LED fan',scene);fan.parent=model.limbs[2];fan.position.set(0,-.54,0);
  fanInk=material('cyan fan','#73dce5',.8);
  const radius=.48,angles=Array.from({length:9},(_,i)=>-Math.PI*.42+i*Math.PI*.84/8);
  const positions=[0,0,0],indices=[];
  for(const a of angles)positions.push(Math.sin(a)*radius,-Math.cos(a)*radius,0);
  for(let i=1;i<angles.length;i++)indices.push(0,i,i+1);
  const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
  const mesh=new B.Mesh('VIP personal fan fabric',scene),data=new B.VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);mesh.parent=fan;mesh.material=fanInk;mesh.isPickable=false;mesh.checkCollisions=false;fanInk.backFaceCulling=false;
  for(const a of angles){const rib=part('fan rib','CreateCylinder',{height:radius,diameter:.012,tessellation:6},fan,fanInk,Math.sin(a)*radius/2,-Math.cos(a)*radius/2,.008);rib.rotation.z=a;}
 }
 function clearTower(){tower?.dispose();tower=null;towerKey='';for(const m of towerInks)m.dispose();towerInks=[];streams=[];}
 function createTower(anchor){
  clearTower();towerKey=anchor.key;tower=new B.TransformNode('VIP mini champagne tower',scene);tower.position.set(anchor.x,anchor.y,anchor.z);
  const glass=material('champagne glass','#c8dadd',.05),gold=material('champagne gold','#dbaa45',.12),tray=material('tower tray','#706587');glass.alpha=.55;towerInks=[glass,gold,tray];
  part('tray','CreateCylinder',{height:.025,diameter:.54,tessellation:24},tower,tray,0,.012,0);
  for(let level=0;level<3;level++){
   const count=3-level;
   for(let row=0;row<count;row++)for(let col=0;col<count-row;col++){
    const x=(col-(count-row-1)/2)*.14,z=(row-(count-1)/2)*.125,y=.035+level*.15;
    part('glass foot','CreateCylinder',{height:.01,diameter:.065,tessellation:12},tower,glass,x,y,z);
    part('glass stem','CreateCylinder',{height:.055,diameter:.014,tessellation:8},tower,glass,x,y+.03,z);
    part('glass bowl','CreateCylinder',{height:.055,diameterTop:.105,diameterBottom:.035,tessellation:14},tower,glass,x,y+.08,z);
    part('champagne surface','CreateCylinder',{height:.009,diameter:.083,tessellation:14},tower,gold,x,y+.10,z);
   }
  }
  for(const x of [-.075,.075])streams.push(part('gold flow','CreateCylinder',{height:.29,diameter:.009,tessellation:6},tower,gold,x,.24,0));
 }
 return {
  render(actor,beat,reduced=false,dancing=false){
   const visible=actor.danceProp==='fan'&&actor.seat==null&&actor.trainSlot==null&&!['pole-dance','podium-dance'].includes(actor.action);
   if(visible&&!fan)createFan();if(fan){fan.setEnabled(visible);if(visible){fan.rotation.set(.12,0,-.15);if(dancing){const w=reduced?0:Math.sin(beat*Math.PI);model.limbs[2].rotation.x=-.65+.25*w;model.limbs[2].rotation.z=1.25+.48*w;fan.rotation.z=-.15+.18*w;}}}
   const anchor=actor.vipTowerSeat===actor.seat&&actor.action==='sit'?vipTableAnchor(actor):null;
   if(anchor){if(towerKey!==anchor.key)createTower(anchor);for(const [i,m]of streams.entries())m.scaling.y=.84+.16*Math.sin((reduced?0:beat)*Math.PI+i*Math.PI);}
   else if(tower)clearTower();
  },
  dispose(){fan?.dispose();fanInk?.dispose();clearTower();},
 };
}
