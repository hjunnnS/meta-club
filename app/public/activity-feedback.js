export function activityFeedback(B,scene){
 const ink=new B.StandardMaterial('action acknowledgement',scene);ink.disableLighting=true;
 ink.emissiveColor=B.Color3.FromHexString('#a6fff0');ink.alpha=.8;
 const ring=B.MeshBuilder.CreateTorus('action start ring',{diameter:1.05,thickness:.018,tessellation:32},scene);
 const spark=B.MeshBuilder.CreateSphere('wand acknowledgement',{diameter:.22,segments:6},scene);
 const seat=B.MeshBuilder.CreateTorus('empty sofa selection',{diameter:.85,thickness:.025,tessellation:32},scene);
 for(const mesh of [ring,spark,seat]){mesh.material=ink;mesh.isPickable=false;mesh.checkCollisions=false;mesh.setEnabled(false);}
 let current=null;
 return {
  start(id,kind){current={id,kind,at:performance.now()};},
  seat(target){seat.setEnabled(Boolean(target));if(target)seat.position.set(target.x,target.y+.49,target.z);},
  tick(models,now,reduced){
   const m=current&&models.get(current.id),age=current?(now-current.at)/1000:2;
   if(!m||age>.85){ring.setEnabled(false);spark.setEnabled(false);return;}
   ring.setEnabled(true);ring.position.copyFrom(m.root.position);ring.position.y+=.055;
   ring.scaling.setAll(reduced?1:1+age*.65);ring.visibility=Math.max(0,1-age/.85);
   spark.setEnabled(current.kind==='wand');
   if(current.kind==='wand'){
    const wand=m.root.getChildMeshes().find(mesh=>mesh.name==='mood wand');
    spark.position.copyFrom(wand?wand.getAbsolutePosition():m.root.position.add(new B.Vector3(.4,1.4,0)));
    spark.scaling.setAll(reduced?1:1+.9*Math.sin(age*Math.PI/.85));spark.visibility=ring.visibility;
   }else if(!reduced&&age<.45&&m.actor.seat==null){
    const intro=Math.sin(age/.45*Math.PI);m.near.position.y-=.07*intro;
    m.limbs[2].rotation.z+=.35*intro;
   }
  }
 };
}
