import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {speakerPulse,musicSpeakers} from '../app/public/ceiling-lights.js';
const B=createRequire(import.meta.url)('../dance/node_modules/babylonjs/babylon.js');
test('speakers follow measured bass and the music beat, with quiet and reduced-motion states',()=>{
  const silent=speakerPulse(0,[0,0,0],true,16);
  const hit=speakerPulse(0,[1,1,1],true,100);
  const tail=speakerPulse(.8,[1,1,1],true,100);
  assert.equal(silent.travel,0);assert(hit.travel>tail.travel);
  assert(hit.light>tail.light);assert(hit.travel<=.27);assert(hit.travel>.25);
  assert(hit.light>5.8);
  assert(hit.light>speakerPulse(1,[1,1,1],true,100).light);
  assert.equal(speakerPulse(0,[1,1,1],false,16,1).travel,0);
  assert.equal(speakerPulse(0,[],true,16,1).level,0);
  assert.equal(speakerPulse(0,[1,1,1],true,16,1,true).travel,0);
  assert(speakerPulse(0,[1,1,1],true,16,0).travel>speakerPulse(0,[.1,.1,.1],true,16,0).travel);
});
test('only speaker cones and private edge materials animate; fixed cabinet and other cyan lights remain intact',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 try{
  const cone=B.MeshBuilder.CreateBox('West speaker woofer',{},scene);
  const cap=B.MeshBuilder.CreateBox('West speaker dust cap',{},scene);
  const cabinet=B.MeshBuilder.CreateBox('West speaker cabinet',{},scene);
  const strip=B.MeshBuilder.CreateBox('West speaker trim',{},scene);
  const other=B.MeshBuilder.CreateBox('other neon',{},scene);
  const material=new B.StandardMaterial('Ice LED',scene);
  material.emissiveColor.set(.045,.64,1);strip.material=other.material=material;
  const render=musicSpeakers(B,scene);
  render(0,[1,1,1],true,100);
  assert(cone.position.x>0);assert.equal(cap.position.x,cone.position.x);
  assert.equal(cabinet.position.x,0);assert.notEqual(strip.material,other.material);
  assert.deepEqual(material.emissiveColor.asArray(),[.045,.64,1]);
  let color=strip.material.emissiveColor;
  assert(color.g>color.r&&color.b>color.r); // cyan
  render(2,[1,1,1],true,100);color=strip.material.emissiveColor;
  assert(color.r>color.b&&color.b>color.g); // pink
  render(4,[1,1,1],true,100);color=strip.material.emissiveColor;
  assert(color.b>color.r&&color.r>color.g); // violet
  assert.equal(cabinet.position.x,0);
  render(0,[],false,16);assert.equal(cone.position.x,0);assert.equal(cap.position.x,0);
 }finally{scene.dispose();engine.dispose();}
});
