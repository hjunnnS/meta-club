import {socialDurations} from './social-trial.js';
import {wandOrnament} from './wand-ornament.js';

// Recipient-only presentation. Restore every overridden pose before the normal dance frame.
export function socialEffects(B,scene,glow){
 const records=new Map();let shared=[];
 function restore(record){
  const saved=record.saved;if(!saved)return;
  if(!saved.model.root.isDisposed()){
   saved.model.root.rotation.y=saved.yaw;
   saved.limbs.forEach(({node,rotation,quaternion})=>{if(!node.isDisposed()){node.rotation.copyFrom(rotation);node.rotationQuaternion=quaternion;}});
   if(saved.hiddenWand)saved.model.showWand(Boolean(saved.model.actor.wand),true);
  }
  record.saved=null;
 }
 function restoreAll(){for(const record of records.values())restore(record);}
 scene.onBeforeRenderObservable.add(restoreAll);
 function dispose(record){restore(record);for(const mesh of record.excluded)glow?.removeExcludedMesh(mesh);record.root.dispose();for(const ink of record.inks)ink.dispose();records.delete(record.event.id);}
 function create(event){
  // A receiver presents one held gift at a time; a later gift replaces the held object.
  if(event.kind!=='heart')for(const old of [...records.values()])if(old.event.to===event.to&&old.event.kind!=='heart')dispose(old);
  const root=new B.TransformNode('social overlay '+event.id,scene),inks=[],meshes=[],excluded=[];
  const ink=(name,color)=>{const m=new B.StandardMaterial('social '+name,scene);m.disableLighting=true;m.emissiveColor=B.Color3.FromHexString(color);inks.push(m);return m;};
  const rose=ink('rose','#ff72bf'),cream=ink('cream','#fff0df'),gold=ink('gold','#ffd879'),green=ink('leaves','#4ed6ad');
  function part(mesh,material,x=0,y=0,z=0){mesh.parent=root;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=false;meshes.push(mesh);return mesh;}
  const sphere=(name,d,mat,x,y,z)=>part(B.MeshBuilder.CreateSphere('social '+name,{diameter:d,segments:10},scene),mat,x,y,z);
  const cylinder=(name,h,d,mat,x,y,z)=>part(B.MeshBuilder.CreateCylinder('social '+name,{height:h,diameter:d,tessellation:24},scene),mat,x,y,z);
  const record={event,root,inks,meshes,excluded};
  if(event.kind==='heart'){
   const hearts=[];for(let i=0;i<7;i++){const heart=wandOrnament(B,scene,root,'heart',rose);heart.rotation.z=0;hearts.push(heart);}record.hearts=hearts;
  }else if(event.kind==='bouquet'){
   const holder=new B.TransformNode('social bouquet holder',scene);holder.parent=root;record.holder=holder;
   for(let i=0;i<7;i++){
    const a=i*2.4,x=Math.cos(a)*.14,z=Math.sin(a)*.10,y=.25+(i%3)*.065;
    cylinder('flower stem',.45,.02,green,x,.02,z);
    sphere('flower centre',.09,gold,x,y,z);
    for(let j=0;j<5;j++){const b=j*Math.PI*2/5;sphere('flower petal',.12,i%2?cream:rose,x+Math.cos(b)*.075,y+Math.sin(b)*.055,z);}
   }
   cylinder('bouquet ribbon',.09,.26,gold,0,-.08,0);
   for(const mesh of meshes)mesh.parent=holder;holder.scaling.setAll(1.65);holder.rotation.x=-.22;
  }else if(event.kind==='cake'){
   part(B.MeshBuilder.CreateBox('social serving tray',{width:1.03,height:.045,depth:.78},scene),gold,0,-.02,0);
   cylinder('cake plate',.035,.78,cream,0,.02,0);cylinder('cake lower',.22,.65,cream,0,.145,0);cylinder('cake top',.16,.45,rose,0,.335,0);
   const flames=[];for(let i=0;i<3;i++){const x=(i-1)*.12;cylinder('candle',.15,.025,cream,x,.48,0);flames.push(sphere('candle flame',.055,gold,x,.585,0));}record.flames=flames;
  }
  for(const mesh of root.getChildMeshes())if(!mesh.name.includes('flame')){glow?.addExcludedMesh(mesh);excluded.push(mesh);}
  records.set(event.id,record);return record;
 }
 function receivingPose(record,target,sender){
  if(['pole-dance','podium-dance'].includes(target.actor.action))return;
  const arms=record.event.kind==='cake'?[target.limbs[0],target.limbs[2]]:[target.limbs[0]];
  record.saved={model:target,yaw:target.root.rotation.y,limbs:arms.map(node=>({node,rotation:node.rotation.clone(),quaternion:node.rotationQuaternion?.clone()||null})),hiddenWand:record.event.kind==='cake'};
  const direction=sender.root.position.subtract(target.root.position);direction.y=0;
  if(direction.lengthSquared()>.01)target.root.rotation.y=Math.atan2(-direction.x,-direction.z);
  arms.forEach((node,i)=>{node.rotationQuaternion=null;node.rotation.x=-1.05;node.rotation.z=i===0?.12:-.12;});
  if(record.saved.hiddenWand)target.showWand(false,true);
 }
 function render(now,models){
  restoreAll();
  // Keep only the latest held gift per receiver; hearts may accompany it.
  const events=new Map(),held=new Map();
  for(const event of shared){if(event.kind==='heart')events.set(event.id,event);else if(!held.has(event.to)||held.get(event.to).start<=event.start)held.set(event.to,event);}
  for(const event of held.values())events.set(event.id,event);
  for(const [id,record]of [...records])if(!events.has(id))dispose(record);
  for(const [id,event]of events){
   const target=models.get(event.to),sender=models.get(event.from),age=(now-event.start)/1000;
   if(!target||!sender||age<0||age>=event.seconds){if(records.has(id))dispose(records.get(id));continue;}
   const record=records.get(id)||create(event),{root}=record;
   const fade=Math.max(0,Math.min(1,age/.20,(event.seconds-age)/.5));for(const mesh of root.getChildMeshes())mesh.visibility=fade;
   if(event.kind==='heart'){
    root.position.copyFrom(target.root.position);root.position.y+=2.1+(target.actor.seat!=null?-.28:0);
    record.hearts.forEach((heart,i)=>{const a=(i-1)*Math.PI*2/6+age*.35,r=i?.28+Math.min(.35,age*.08):0;
     heart.position.set(Math.cos(a)*r,i?Math.sin(age*2+i)*.13:.1+Math.sin(age*2)*.06,Math.sin(a)*r);
     heart.scaling.setAll((i?.80:2.6)*Math.min(1,age/.22));heart.rotation.y=-scene.activeCamera?.rotation?.y||0;
    });
   }else{
    receivingPose(record,target,sender);
    const yaw=target.root.rotation.y,front=new B.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    root.rotationQuaternion=null;root.rotation.set(0,yaw,0);root.position.copyFrom(target.root.position).addInPlace(front.scale(.60));
    root.position.y+=1.05+(target.actor.seat!=null?-.22:0);
    if(record.holder){record.holder.rotation.z=Math.sin(age*2.5)*.07;root.position.y+=.03*Math.sin(Math.min(1,age)*Math.PI);}
    record.flames?.forEach((mesh,i)=>mesh.scaling.setAll(.85+.15*Math.sin(age*9+i)));
   }
  }
 }
 scene.onDisposeObservable.addOnce(()=>{for(const record of [...records.values()])dispose(record);});
 return {
  set(events){shared=(events||[]).filter(e=>Object.hasOwn(socialDurations,e.kind)&&Number.isFinite(e.start)&&e.seconds===socialDurations[e.kind]);},
  stop(){shared=[];for(const record of [...records.values()])dispose(record);},
  render,
  activeCount(){return records.size;},
 };
}
