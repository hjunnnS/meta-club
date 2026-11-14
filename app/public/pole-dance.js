// Separate from the existing dance motions: one hand tracks a fixed world grip.
export function releasePoleGrip(model){
  if(model.poleGripArm==null)return;
  const joint=model.limbs[model.poleGripArm];
  joint.rotationQuaternion=null;joint.scaling.y=1;
  model.poleGripArm=null;
}
export function animatePoleDance(B,model,pole,beat,energy=0,reduced=false){
  const cycle=(reduced?0:beat)*Math.PI*2,weight=Math.sin(cycle/2);
  model.near.position.set(.025*weight,.025*(1-Math.cos(cycle)),0);
  model.near.rotation.set(0,0,.045*weight);
  model.torso.rotation.z=.055*weight;
  for(const [i,joint] of model.limbs.entries()){
    joint.rotation.set(0,0,0);
    if(i%2){joint.rotation.x=.07*Math.max(0,(i===1?-1:1)*weight);joint.rotation.z=(i===1?-.08:.08);}
    else{joint.rotation.z=(i===0?-1:1)*(.7+.3*Math.sin(cycle/2));joint.rotation.x=-.22;}
  }
  model.root.computeWorldMatrix(true);model.near.computeWorldMatrix(true);
  const world=model.near.getWorldMatrix(),inverse=world.clone().invert();
  const arms=[0,2];
  const shoulder=i=>B.Vector3.TransformCoordinates(model.limbs[i].position,world);
  const distance=i=>Math.hypot(shoulder(i).x-pole.x,shoulder(i).z-pole.z);
  // Keep the chosen hand until this activity ends; never swap hands mid-beat.
  if(model.poleGripArm==null)model.poleGripArm=distance(0)<distance(2)?0:2;
  const index=model.poleGripArm,joint=model.limbs[index],at=shoulder(index);
  const dx=at.x-pole.x,dz=at.z-pole.z,length=Math.hypot(dx,dz)||1;
  const grip=new B.Vector3(pole.x+dx/length*.055,model.root.position.y+1.48,pole.z+dz/length*.055);
  const target=B.Vector3.TransformCoordinates(grip,inverse).subtract(joint.position);
  const reach=target.length(),direction=target.scale(1/Math.max(.001,reach));
  const down=new B.Vector3(0,-1,0),axis=B.Vector3.Cross(down,direction);
  const dot=Math.max(-1,Math.min(1,B.Vector3.Dot(down,direction)));
  joint.rotationQuaternion=axis.lengthSquared()>.000001?B.Quaternion.RotationAxis(axis.normalize(),Math.acos(dot))
    :dot>0?B.Quaternion.Identity():B.Quaternion.RotationAxis(B.Axis.X,Math.PI);
  // Existing capsule's wrist ends 0.525m below its shoulder; align it to the grip.
  joint.scaling.y=reach/.525;
  const free=model.limbs[index===0?2:0];
  free.rotation.z=(index===0?1:-1)*(.95+.42*Math.sin(cycle/2));
  free.rotation.x=-.25-.18*Math.min(1,energy)*(1+Math.sin(cycle));
}
