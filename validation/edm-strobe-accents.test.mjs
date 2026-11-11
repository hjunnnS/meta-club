import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {strobeAccentCue,strobeAccents} from '../app/public/ceiling-lights.js';
const B=createRequire(import.meta.url)('../dance/node_modules/babylonjs/babylon.js');
const cue=(beat,extra={})=>strobeAccentCue({beat,bpm:132,playing:true,...extra});
test('three looks follow existing normal/large strobe timing, with previews and overlap protection',()=>{
 assert(cue(2).fan>0);assert.equal(cue(2).curtain,0);
 assert(cue(19).curtain>0);assert(cue(19).gobo>0);
 assert(cue(51).gobo>0);assert.equal(cue(51).curtain,0);
 assert(cue(83).gobo>0&&cue(83).curtain>0);
 assert.deepEqual(cue(19,{playing:false}),{curtain:0,fan:0,gobo:0});
 assert(cue(19,{arrangement:.3}).gobo>0);
 assert(cue(19,{arrangement:.3}).fan===0);
 assert(cue(19,{overlap:true}).curtain<cue(19).curtain);
 assert.equal(cue(19,{protectSmoke:true}).curtain,0);
 assert(cue(19,{reduced:true}).curtain<cue(19).curtain);
 for(const kind of ['curtain','fan','gobo']){
  assert(cue(19,{playing:false,preview:{kind,age:1}})[kind]>0);
  assert.deepEqual(cue(19,{playing:false,preview:{kind,age:9}}),{curtain:0,fan:0,gobo:0});
 }
 assert(cue(19,{playing:false,strobePreview:{kind:'transition',age:1}}).fan>0);
});
test('effect geometry never blocks paths and all three rigs stop cleanly',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);
 try{
  const render=strobeAccents(B,scene);
  assert.equal(scene.lights.length,0);
  assert(scene.meshes.every(mesh=>!mesh.isPickable&&!mesh.checkCollisions));
  render({curtain:1,fan:1,gobo:1},4,.8);
  assert.equal(scene.meshes.filter(mesh=>mesh.isEnabled()).length,60);
  assert(scene.meshes.every(mesh=>Number.isFinite(mesh.position.x)&&Number.isFinite(mesh.scaling.y)));
  render({curtain:0,fan:0,gobo:0},4,0);
  assert(scene.meshes.every(mesh=>!mesh.isEnabled()));
 }finally{scene.dispose();engine.dispose();}
});
