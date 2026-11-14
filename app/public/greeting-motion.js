// Short additive gestures: never replace an actor's authoritative dance or wand state.
export function greetingMotion(B,scene,glow){
 let events=[],selected=null,ring=null,heartInk=null;const saved=new Map(),hearts=new Map();
 const smooth=t=>t*t*(3-2*t);
 function restore(){for(const [m,s]of saved){if(m.root.isDisposed())continue;m.root.rotation.copyFrom(s.root);m.near.rotation.copyFrom(s.near);m.torso.rotation.copyFrom(s.torso);m.limbs.forEach((j,i)=>j.rotation.copyFrom(s.limbs[i]));}saved.clear();}
 function clearHeart(id){const mesh=hearts.get(id);if(mesh){glow?.removeExcludedMesh(mesh);mesh.dispose();hearts.delete(id);}}
 function handHeart(id,model,gain,reduced,age){
  let mesh=hearts.get(id);
  if(!mesh){
   // One small, original heart silhouette: no particles, lights or body/wand changes.
   const positions=[0,0,0],indices=[],count=48;
   for(let i=0;i<count;i++){const t=i/count*Math.PI*2;positions.push(Math.pow(Math.sin(t),3)*.5,(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)+2)/32,0);}
   for(let i=1;i<=count;i++)indices.push(0,i,i===count?1:i+1);
   const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
   mesh=new B.Mesh('greeting hand heart',scene);const data=new B.VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);
   if(!heartInk){heartInk=new B.StandardMaterial('greeting heart rose',scene);heartInk.disableLighting=true;heartInk.emissiveColor=B.Color3.FromHexString('#ff6fa7');heartInk.backFaceCulling=false;}
   mesh.material=heartInk;mesh.billboardMode=B.Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false;mesh.checkCollisions=false;
   glow?.addExcludedMesh(mesh);hearts.set(id,mesh);
  }
  model.root.computeWorldMatrix(true);model.near.computeWorldMatrix(true);const hand=model.limbs[0];hand.computeWorldMatrix(true);
  const at=B.Vector3.TransformCoordinates(new B.Vector3(0,-.525,0),hand.getWorldMatrix()),camera=scene.activeCamera,engine=scene.getEngine();
  const distance=camera?B.Vector3.Distance(camera.globalPosition||camera.position,at):0;
  const readable=camera?distance*2*Math.tan(camera.fov/2)*52/Math.max(1,engine.getRenderHeight()):0;
  const size=Math.max(.9,readable)*(reduced?1:1+.035*Math.sin(age*Math.PI*2));
  mesh.position.copyFrom(at);mesh.position.y+=.12+.40*size;mesh.scaling.setAll(size*(.8+.2*gain));mesh.visibility=gain;
 }
 function render(now,models,reduced=false){
  const liveHearts=new Set();
  if(selected&&models.has(selected)){
   if(!ring){ring=B.MeshBuilder.CreateTorus('selected club visitor',{diameter:.95,thickness:.025,tessellation:24},scene);const ink=new B.StandardMaterial('visitor selection',scene);ink.disableLighting=true;ink.emissiveColor=B.Color3.FromHexString('#b9f4e7');ring.material=ink;ring.isPickable=false;scene.onDisposeObservable.addOnce(()=>ink.dispose());}
   const model=models.get(selected);ring.setEnabled(model.root.isEnabled());ring.position.copyFrom(model.root.position);ring.position.y+=.035;
  }else ring?.setEnabled(false);
  for(const event of events){
   const age=(now-event.start)/1000,m=models.get(event.from),target=models.get(event.to);
   if(!m||!target||age<0||age>=event.seconds||m.actor.action==='walk'||m.actor.seat!=null||['pole-dance','podium-dance'].includes(m.actor.action))continue;
   if(!m.near.isEnabled())continue;
   const gain=smooth(Math.min(1,age/.3))*smooth(Math.min(1,(event.seconds-age)/.35)),phase=reduced?0:age*9;
   saved.set(m,{root:m.root.rotation.clone(),near:m.near.rotation.clone(),torso:m.torso.rotation.clone(),limbs:m.limbs.map(j=>j.rotation.clone())});
   const yaw=Math.atan2(target.actor.x-m.actor.x,target.actor.z-m.actor.z);
   m.root.rotation.y+=Math.atan2(Math.sin(yaw-m.root.rotation.y),Math.cos(yaw-m.root.rotation.y))*gain;
   const arm=(i,x,z)=>{const j=m.limbs[i];j.rotation.x+=(x-j.rotation.x)*gain;j.rotation.z+=(z-j.rotation.z)*gain;};
   if(event.kind==='wave')arm(0,-.2,-2.45+Math.sin(phase)*.28);
   if(event.kind==='bow'){m.near.rotation.x+=.20*Math.sin(age/event.seconds*Math.PI)*gain;arm(0,-.2,-.12);}
   if(event.kind==='heart'){
    // Pinch-heart with the free left hand; the right wand arm keeps its existing motion.
    arm(0,-.30,-2.15);
    if(!m.actor.wand&&m.actor.danceProp!=='fan')arm(2,-.10,.15);
    handHeart(event.id,m,gain,reduced,age);liveHearts.add(event.id);
   }
   if(event.kind==='clap'){const reach=.42+.12*Math.sin(phase);arm(0,-1.25,reach);arm(2,-1.25,-reach);}
  }
  for(const id of hearts.keys())if(!liveHearts.has(id))clearHeart(id);
 }
 scene.onDisposeObservable.addOnce(()=>{saved.clear();ring?.dispose();for(const id of hearts.keys())clearHeart(id);heartInk?.dispose();});
 return {set(value){events=Array.isArray(value)?value:[];},active(id,now){return events.some(g=>g.from===id&&now>=g.start&&now<g.start+g.seconds*1000);},select(id){selected=id;},restore,render};
}
