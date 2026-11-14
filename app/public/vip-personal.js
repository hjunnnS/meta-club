export {vipCommands,vipPersonalCommand} from './vip-personal-state.js';
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
 let fan=null,fanInk=null;
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
 return {
  render(actor,beat,reduced=false,dancing=false){
   const visible=actor.danceProp==='fan'&&actor.seat==null&&actor.trainSlot==null&&!['pole-dance','podium-dance'].includes(actor.action);
   if(visible&&!fan)createFan();if(fan){fan.setEnabled(visible);if(visible){fan.rotation.set(.12,0,-.15);if(dancing){const w=reduced?0:Math.sin(beat*Math.PI);model.limbs[2].rotation.x=-.65+.25*w;model.limbs[2].rotation.z=1.25+.48*w;fan.rotation.z=-.15+.18*w;}}}

  },
  dispose(){fan?.dispose();fanInk?.dispose();},
 };
}
