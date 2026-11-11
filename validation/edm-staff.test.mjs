import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {staffNPC,animateStaff} from '../app/public/avatar.js';
const B=createRequire(import.meta.url)('../dance/node_modules/babylonjs/babylon.js');
test('adult staff use private clothed silhouettes and fixed role positions without changing default avatars',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 const base=new B.StandardMaterial('original player shirt',scene);
 const make=actor=>{
   const root=new B.TransformNode(actor.id,scene),near=new B.TransformNode('detail',scene);near.parent=root;
   const torso=B.MeshBuilder.CreateBox('torso',{},scene);torso.parent=near;torso.material=base;
   const limbs=Array.from({length:4},()=>{const joint=new B.TransformNode('joint',scene);joint.parent=near;return joint;});
   const label=B.MeshBuilder.CreatePlane('label',{},scene),far=B.MeshBuilder.CreateBox('far',{},scene);label.parent=far.parent=root;
   root.position.set(actor.x,actor.y,actor.z);root.rotation.y=actor.yaw;
   return {root,near,torso,limbs,label,far,actor,dispose(){root.dispose();}};
 };
 try{
  for(const role of ['dj','bartender']){
   const model=staffNPC(B,scene,make,role),start=model.root.position.clone();
   assert.equal(model.root.metadata.ageGroup,'adult');assert.equal(model.root.metadata.role,role);
   assert.notEqual(model.torso.material,base);
   const upper=model.near.getChildMeshes().filter(m=>m.name.includes('clothed upper torso'));
   assert.equal(upper.length,2);assert(upper.every(m=>m.material===model.torso.material));
   assert.equal(model.root.position.z,role==='dj'?-13.35:17.4);
   const fixedShape=upper.map(mesh=>({position:mesh.position.asArray(),scale:mesh.scaling.asArray()}));
   animateStaff(model,role,1.2,1.5,.8);
   assert.deepEqual(upper.map(mesh=>({position:mesh.position.asArray(),scale:mesh.scaling.asArray()})),fixedShape);assert.notEqual(model.limbs[2].rotation.x,0);
   assert(model.root.position.equals(start));assert(!model.far.isEnabled());
   if(role==='dj')assert(model.near.getChildMeshes().some(m=>m.name.includes('headphone')));
   else assert(model.near.getChildMeshes().some(m=>m.name.includes('shaker')));
   model.dispose();
  }
  assert.equal(base.name,'original player shirt');assert(scene.materials.includes(base));
 }finally{scene.dispose();engine.dispose();}
});
