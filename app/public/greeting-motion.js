// Short additive gestures: never replace an actor's authoritative dance or wand state.
export function greetingMotion(B,scene,glow){
 let events=[],self=null,selected=null,ring=null,heartInk=null;const saved=new Map(),hearts=new Map(),balloons=new Map(),waves=new Map();
 const labels={wave:'손 흔들기',bow:'가볍게 인사',heart:'손하트',clap:'응원 박수'};
 const emojis={wave:'👋',bow:'🙇',heart:'🫶',clap:'👏'};
 function clearBalloon(id){const item=balloons.get(id);if(!item)return;glow?.removeExcludedMesh(item.mesh);item.mesh.dispose();item.ink.dispose();item.texture.dispose();balloons.delete(id);}
 function showBalloon(event,model,target,now){
  const incoming=event.to===self,heading=incoming?'나에게':target?String(target.actor.nickname||'상대')+'님에게':'인사';
  const key=heading+'|'+event.kind;let item=balloons.get(event.id);
  if(item&&item.key!==key){clearBalloon(event.id);item=null;}
  if(!item){
   const texture=new B.DynamicTexture('greeting balloon',{width:640,height:256},scene,false),ctx=texture.getContext();
   ctx.clearRect(0,0,640,256);ctx.fillStyle=incoming?'#193638':'#231a35';ctx.strokeStyle=incoming?'#b9f4e7':'#d4bbf0';ctx.lineWidth=5;
   ctx.beginPath();ctx.moveTo(28,8);ctx.lineTo(612,8);ctx.quadraticCurveTo(632,8,632,28);ctx.lineTo(632,196);ctx.quadraticCurveTo(632,216,612,216);ctx.lineTo(348,216);ctx.lineTo(320,248);ctx.lineTo(292,216);ctx.lineTo(28,216);ctx.quadraticCurveTo(8,216,8,196);ctx.lineTo(8,28);ctx.quadraticCurveTo(8,8,28,8);ctx.closePath();ctx.fill();ctx.stroke();
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=incoming?'#b9f4e7':'#d4bbf0';ctx.font='bold 38px sans-serif';ctx.fillText(heading,320,39,570);
   ctx.font='126px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';ctx.fillText(emojis[event.kind],320,120);
   ctx.fillStyle='#ffffff';ctx.font='bold 36px sans-serif';ctx.fillText(labels[event.kind],320,190,570);texture.update();texture.hasAlpha=true;
   const ink=new B.StandardMaterial('greeting balloon',scene);ink.disableLighting=true;ink.diffuseTexture=ink.emissiveTexture=texture;ink.useAlphaFromDiffuseTexture=true;ink.backFaceCulling=false;ink.disableDepthWrite=true;ink.depthFunction=B.Constants.ALWAYS;
   const mesh=B.MeshBuilder.CreatePlane('greeting balloon',{width:2.5,height:1},scene);mesh.material=ink;mesh.billboardMode=B.Mesh.BILLBOARDMODE_ALL;mesh.renderingGroupId=3;mesh.isPickable=false;mesh.checkCollisions=false;
   glow?.addExcludedMesh(mesh);item={mesh,ink,texture,key};balloons.set(event.id,item);
  }
  const mesh=item.mesh;mesh.setEnabled(model.root.isEnabled());
  const head=model.near?.getChildMeshes().find(part=>part.name==='head');
  if(head){head.computeWorldMatrix(true);const bounds=head.getBoundingInfo();mesh.position.copyFrom(bounds.boundingSphere.centerWorld);mesh.position.y=bounds.boundingBox.maximumWorld.y;}
  else{mesh.position.copyFrom(model.root.position);mesh.position.y+=1.85;}
  const camera=scene.activeCamera,engine=scene.getEngine();let scale=1;
  if(camera){const distance=B.Vector3.Distance(camera.globalPosition||camera.position,mesh.position);scale=Math.max(1,distance*2*Math.tan(camera.fov/2)*Math.min(190,engine.getRenderWidth()*.36)/Math.max(1,engine.getRenderHeight())/2.5);}
  // Keep a readable middle size: 60% of the initial balloon, at every distance.
  scale*=.6;mesh.scaling.setAll(scale);mesh.position.y+=.16+.5*scale;
  mesh.visibility=Math.min(1,(now-event.start)/120,(event.start+event.seconds*1000-now)/220);
 }
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
  const liveBalloons=new Set(),targeted=new Set(events.map(event=>event.from));
  for(const event of events){
   const model=models.get(event.from),target=models.get(event.to);
   if(!labels[event.kind]||!model||!target||event.from!==self&&event.to!==self||now<event.start||now>=event.start+event.seconds*1000||model.actor.action==='walk'||model.actor.seat!=null||['pole-dance','podium-dance'].includes(model.actor.action))continue;
   showBalloon(event,model,target,now);liveBalloons.add(event.id);
  }
  // The existing untargeted dance-menu wave still gets a sender-side label.
  for(const [id,model]of models){
   if(id!==self||model.actor.action!=='wave'){waves.delete(id);continue;}
   if(!waves.has(id))waves.set(id,{id:'wave-'+id+'-'+now,from:id,kind:'wave',start:now,seconds:3});
   const event=waves.get(id);if(!targeted.has(id)&&now<event.start+3000){showBalloon(event,model,null,now);liveBalloons.add(event.id);}
  }
  for(const id of balloons.keys())if(!liveBalloons.has(id))clearBalloon(id);
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
 scene.onDisposeObservable.addOnce(()=>{saved.clear();waves.clear();ring?.dispose();for(const id of balloons.keys())clearBalloon(id);for(const id of hearts.keys())clearHeart(id);heartInk?.dispose();});
 return {set(value,viewer=self){events=Array.isArray(value)?value:[];self=viewer;},active(id,now){return events.some(g=>g.from===id&&now>=g.start&&now<g.start+g.seconds*1000);},select(id){selected=id;},restore,render};
}
