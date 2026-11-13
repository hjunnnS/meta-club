import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,registerHooks} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {birthdayRequests} from '../app/birthday-requests.js';
import {socialTrial,socialDurations} from '../app/social-trial.js';
import {wandThemes,wandDecorations,wandTrails,validWandStyle,normalizeWandStyle} from '../app/public/wand-customization.js';
import {wandOrnament} from '../app/public/wand-ornament.js';
import {createWandTrail} from '../app/public/wand-trail.js';
const B=createRequire(import.meta.url)('../dance/node_modules/babylonjs/babylon.js');
// Mirror the app's public module routes for the headless tests, not production code.
registerHooks({resolve(specifier,context,next){
  if(specifier==='/clubs/edm/edm-layout.js'||specifier==='./edm-layout.js'&&context.parentURL?.includes('/app/public/'))
    return {url:new URL('../app/edm-layout.js',import.meta.url).href,shortCircuit:true};
  if(specifier==='./social-trial.js'&&context.parentURL?.includes('/app/public/'))
    return {url:new URL('../app/social-trial.js',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const {socialEffects,cakePosition}=await import('../app/public/social-effects.js');
const {edmSeats,edmBalcony}=await import('../app/edm-layout.js');
test('recipient consent, decline, cancel, departure and duplicate replies are isolated',()=>{
 let actors=[{id:'a',nickname:'A'},{id:'b',nickname:'B'},{id:'c',nickname:'C'}],starts=0;
 const requests=birthdayRequests(()=>actors,()=>{starts++;});
 let request=requests.propose('a','b');assert.equal(request.status,'pending');assert.equal(starts,0);
 assert.deepEqual(requests.propose('a','b'),request);assert(requests.answer('c',request.id,true).error);
 assert.equal(requests.state('c').requests.length,0);
 assert.equal(requests.answer('b',request.id,false).status,'declined');assert.equal(starts,0);
 request=requests.propose('a','b');requests.cancel('a',request.id);requests.answer('b',request.id,true);assert.equal(starts,0);
 request=requests.propose('a','b');requests.answer('b',request.id,true);requests.answer('b',request.id,true);assert.equal(starts,1);
 request=requests.propose('a','b');actors=actors.filter(a=>a.id!=='b');assert.equal(requests.state('a').requests.at(-1).status,'unavailable');
 assert(requests.propose('a','a').error);assert(requests.propose('a','missing').error);
});
test('new effect lifetimes, cancellation and departing actors cannot leave stale events',()=>{
 let now=1000,actors=[{id:'a'},{id:'b'}];const events=socialTrial(()=>actors,()=>now);
 assert.equal(events.add('unknown','a','b'),null);
 for(const kind of Object.keys(socialDurations))assert(events.add(kind,'a','b'));
 assert.equal(events.snapshot().length,4);events.stop('outsider');assert.equal(events.snapshot().length,4);
 now+=16000;assert.equal(events.snapshot().length,0);
 events.add('cake','a','b');actors.pop();assert.equal(events.snapshot().length,0);
 actors.push({id:'b'});events.add('heart','a','b');events.stop('a');assert.equal(events.snapshot().length,0);
});
test('all 48 trial customization combinations validate; unknown rights and styles are rejected',()=>{
 let count=0;for(const color of wandThemes)for(const [decoration]of wandDecorations)for(const [trail]of wandTrails){
   const style={color:color.id,decoration,trail};assert(validWandStyle(style));assert.deepEqual(normalizeWandStyle(style),style);count++;
 }
 assert.equal(count,48);assert(!validWandStyle({color:'rose',decoration:'weapon',trail:'default'}));
 assert(!validWandStyle({...normalizeWandStyle(),owned:true}));assert.deepEqual(normalizeWandStyle({color:'bad'}),normalizeWandStyle());
});
test('star, heart and crown attach and dispose without changing the base rod',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),tip=new B.TransformNode('tip',scene),ink=new B.StandardMaterial('ink',scene);
 try{for(const kind of ['star','heart','crown']){const ornament=wandOrnament(B,scene,tip,kind,ink);assert.equal(ornament.parent,tip);assert(ornament.getChildMeshes().length);
   for(const mesh of ornament.getChildMeshes()){assert.equal(mesh.isPickable,false);assert.equal(mesh.material,ink);assert(mesh.getVerticesData('position').every(Number.isFinite));}
   ornament.dispose();assert.equal(tip.getChildMeshes().length,0);
 }}finally{scene.dispose();engine.dispose();}
});
test('double and star-dust trails retain a curved finite path and clean up on reset',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),trail=createWandTrail(B,scene);
 try{for(const variant of ['default','double','sparkles']){
   trail.setPalette('#ff78ca','#391126');trail.setVariant(variant);
   for(let i=0;i<16;i++)trail.update(new B.Vector3(Math.sin(i*.12),1+i*.02,Math.cos(i*.12)*.4),i*16+1000,1,false,3);
   const drawn=scene.meshes.filter(m=>m.visibility>0&&m.isEnabled());assert(drawn.length>=2);
   for(const mesh of drawn)assert(mesh.getVerticesData('position').every(Number.isFinite));
   trail.reset();assert(scene.meshes.every(m=>m.visibility===0||!m.isEnabled()));
 }
 trail.dispose();assert.equal(scene.meshes.length,0);
 }finally{scene.dispose();engine.dispose();}
});
function model(scene,id,x=0,y=0,z=0){
 const root=new B.TransformNode(id,scene);root.position.set(x,y,z);const near=new B.TransformNode('near',scene);near.parent=root;
 const body=B.MeshBuilder.CreateBox('unchanged body',{},scene);body.parent=near;
 const limbs=Array.from({length:4},()=>{const l=new B.TransformNode('limb',scene);l.parent=near;return l;});
 return {root,near,limbs,actor:{id,x,y,z,yaw:0,seat:null}};
}
test('birthday follows a moving/seated target and removes only its own lights and meshes',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),house=new B.HemisphericLight('unchanged house light',B.Axis.Y,scene);
 house.intensity=.52;const effects=socialEffects(B,scene),models=new Map([['a',model(scene,'a')],['b',model(scene,'b',2,4,-3)]]);
 try{
   effects.set([{id:'birthday',kind:'birthday',from:'a',to:'b',start:1000,seconds:15}]);effects.render(2000,models);assert.equal(effects.activeCount(),1);
   const target=models.get('b');target.actor.seat=edmSeats.findIndex(s=>s.balcony);target.root.position.x=3;effects.render(12500,models);
   const light=scene.getLightByName('social birthday key');assert(light);assert.equal(light.position.x,2.35);assert.equal(house.intensity,.52);assert.equal(scene.meshes.filter(m=>m.name==='social birthday confetti'&&m.isEnabled()).length,24);
   effects.set([]);effects.render(12600,models);assert.equal(effects.activeCount(),0);assert.equal(scene.lights.length,1);assert.equal(house.intensity,.52);
 }finally{scene.dispose();engine.dispose();}
});
test('heart, bouquet and cake previews do not change dance joints and are removed on end/cancel',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),effects=socialEffects(B,scene),models=new Map([['a',model(scene,'a')],['b',model(scene,'b',2,0,1)]]);
 try{for(const kind of ['heart','bouquet','cake']){
   const rotations=models.get('b').limbs.map(l=>l.rotation.clone());assert(effects.preview(kind,'a','b',1000,models));
   effects.render(2800,models);assert.equal(effects.activeCount(),1);models.get('b').limbs.forEach((l,i)=>assert(l.rotation.equals(rotations[i])));
   effects.render(20000,models);assert.equal(effects.activeCount(),0);
   effects.preview(kind,'a','b',21000,models);effects.stop();assert.equal(effects.activeCount(),0);
 }assert(!scene.meshes.some(m=>m.name.startsWith('social ')));
 }finally{scene.dispose();engine.dispose();}
});
test('cakes use existing table tops on both floors; standing preview remains visual-only',()=>{
 const lower=edmSeats.findIndex(s=>s.table===1),upper=edmSeats.findIndex(s=>s.balcony&&s.area===0);
 assert.deepEqual(cakePosition({seat:lower}),{x:18.5,y:.72,z:16.6});
 const p=edmBalcony.pockets[0];assert.deepEqual(cakePosition({seat:upper}),{x:p.x+p.fx*1.28-p.fz*.16,y:4.51,z:p.z+p.fz*1.28+p.fx*.16});
 assert.equal(cakePosition({x:0,y:0,z:0,yaw:0,seat:null}).y,.04);
});
test('Colyseus handlers share only applied styles and require the actual recipient to accept',async()=>{
 process.env.CLUB_LOCAL_TEST='1';process.env.AUTH_URL='https://localhost:18801';process.env.CLUB_DB=join(mkdtempSync(join(tmpdir(),'club-items-')),'club.sqlite');
 const {EdmRoom,rooms,connected}=await import('../app/club-room.js');
 const room=new EdmRoom(),handlers=new Map();room.roomId='social-items-check';room.onMessage=(kind,handler)=>handlers.set(kind,handler);
 room.setSimulationInterval=room.broadcast=()=>{};room.onCreate();
 const clients=['sender','recipient','outsider'].map(sessionId=>({sessionId,messages:[],send(kind,data){this.messages.push({kind,data:structuredClone(data)});}}));
 try{
   for(const c of clients){room.clients.push(c);room.onJoin(c,{identity:'local-test:'+c.sessionId});}
   const [a,b,c]=clients,style={color:'rose',decoration:'heart',trail:'double'};
   handlers.get('wand-style')(a,style);assert.deepEqual(room.snapshot().actors.find(x=>x.id===a.sessionId).wandStyle,style);
   assert.equal(room.snapshot().actors.find(x=>x.id===b.sessionId).wandStyle,undefined);
   handlers.get('wand-style')(a,{...style,color:'forged'});assert.deepEqual(room.member(a).wandStyle,style);
   handlers.get('birthday-propose')(a,{targetId:b.sessionId});const request=room.birthdays.state(a.sessionId).requests.at(-1);
   assert.equal(room.snapshot().socialEvents.length,0);handlers.get('birthday-reply')(c,{id:request.id,accept:true});assert.equal(room.snapshot().socialEvents.length,0);
   handlers.get('birthday-reply')(b,{id:request.id,accept:true});handlers.get('birthday-reply')(b,{id:request.id,accept:true});
   assert.equal(room.snapshot().socialEvents.length,1);assert.equal(room.stageEvent.kind,'led');
   handlers.get('social-stop')(a);assert.equal(room.snapshot().socialEvents.length,0);assert.equal(room.stageEvent,null);
   handlers.get('birthday-propose')(a,{targetId:b.sessionId});room.removeMember(b,false);assert.equal(room.birthdays.state(a.sessionId).requests.at(-1).status,'unavailable');
 }finally{for(const c of clients){if(room.member(c))room.removeMember(c,false);connected.delete('local-test:'+c.sessionId);}room.clock.clear();rooms.delete(room.roomId);}
});
test('existing music, map, dance, floor and show implementations remain unchanged',()=>{
 const protectedFiles=['stage/festival/events.js','stage/festival/celebration.js','stage/festival/holograms.js','stage/festival/edm-festival.glb',
 'app/public/ambience.js','app/public/ceiling-lights.js','app/public/rhythm-floor.js','app/public/free-dance.js','app/public/music.js','app/club-performances.js','app/edm-layout.js'];
 execFileSync('git',['diff','--exit-code','dc38655','--',...protectedFiles],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
});
