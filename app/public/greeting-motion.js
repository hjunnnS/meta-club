// Short additive gestures: never replace an actor's authoritative dance or wand state.
export function greetingMotion(B,scene){
 let events=[],selected=null,ring=null;const saved=new Map();
 const smooth=t=>t*t*(3-2*t);
 function restore(){for(const [m,s]of saved){if(m.root.isDisposed())continue;m.root.rotation.copyFrom(s.root);m.near.rotation.copyFrom(s.near);m.torso.rotation.copyFrom(s.torso);m.limbs.forEach((j,i)=>j.rotation.copyFrom(s.limbs[i]));}saved.clear();}
 function render(now,models,reduced=false){
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
   if(event.kind==='heart'){arm(0,-.6,-2.85);arm(2,-.6,2.85);}
   if(event.kind==='clap'){const reach=.42+.12*Math.sin(phase);arm(0,-1.25,reach);arm(2,-1.25,-reach);}
  }
 }
 scene.onDisposeObservable.addOnce(()=>{saved.clear();ring?.dispose();});
 return {set(value){events=Array.isArray(value)?value:[];},active(id,now){return events.some(g=>g.from===id&&now>=g.start&&now<g.start+g.seconds*1000);},select(id){selected=id;},restore,render};
}
