import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,registerHooks} from 'node:module';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {clubActivities} from '../app/club-activities.js';
import {socialDurations} from '../app/social-trial.js';
import {wandThemes,wandDecorations,wandTrails,wandSizes,validWandStyle,normalizeWandStyle} from '../app/public/wand-customization.js';
import {wandOrnament} from '../app/public/wand-ornament.js';
import {createWandTrail} from '../app/public/wand-trail.js';
const B=createRequire(import.meta.url)('../dance/node_modules/babylonjs/babylon.js');
registerHooks({resolve(specifier,context,next){
 if(specifier==='/clubs/edm/edm-layout.js'||specifier==='./edm-layout.js'&&context.parentURL?.includes('/app/public/'))return {url:new URL('../app/edm-layout.js',import.meta.url).href,shortCircuit:true};
 if(specifier==='./social-trial.js'&&context.parentURL?.includes('/app/public/'))return {url:new URL('../app/social-trial.js',import.meta.url).href,shortCircuit:true};
 if(specifier==='/stage/festival/events.js')return {url:new URL('../stage/festival/events.js',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {socialEffects}=await import('../app/public/social-effects.js');
const {edmStage,edmFloor}=await import('../app/edm-layout.js');
const {clubEventRenderer,paradePose}=await import('../app/public/club-event-renderer.js');
const roster=()=>['a','b','c'].map(id=>({id,nickname:id,identity:id}));
let sequence=0;const request=extra=>({requestId:String(++sequence),...extra});
test('private whisper isolation, notifications, filtering, duplicates, blocking and reconnect identity',()=>{
 let now=1000,actors=roster();const activity=clubActivities({now:()=>now,actors:()=>actors,identity:id=>actors.find(a=>a.id===id)?.identity,blockedMessage:t=>t.includes('금지')});
 const input=request({to:'b',text:'안녕하세요',from:'c'}),reply=activity.command('a','whisper-send',input);
 assert.equal(reply.notification.to,'b');assert.equal(reply.notification.from,'a');assert.equal(activity.command('a','whisper-send',input).duplicate,true);
 assert.equal(activity.view('a').messages.length,1);assert.equal(activity.view('b').messages.length,1);assert.equal(activity.view('c').messages.length,0);
 assert(!JSON.stringify(activity.snapshot()).includes('안녕하세요'));
 for(const text of ['','금지','bad\ntext','x'.repeat(201)])assert(activity.command('a','whisper-send',request({to:'b',text})).error);
 assert(activity.command('a','whisper-send',request({to:'outside',text:'hello'})).error);
 assert(activity.command('b','whisper-block',{to:'a'}).ok);assert(activity.command('a','whisper-send',request({to:'b',text:'hello'})).error);
 assert(activity.command('b','whisper-send',request({to:'a',text:'hello'})).error);
 actors[0]={id:'a-new',identity:'a',nickname:'A'};assert.deepEqual(activity.view('b').blockedIds,['a-new']);
 assert(activity.command('a-new','whisper-send',request({to:'b',text:'hello'})).error);
 activity.command('b','whisper-unblock',{to:'a-new'});now+=2000;assert(activity.command('a-new','whisper-send',request({to:'b',text:'hello'})).ok);
 for(const input of [null,[],2,'bad'])assert(activity.command('b','vip-start',input).error);
});
test('gifts, FIFO five-second shouts, ten-second five-NPC parade, cancellation and actor departure',()=>{
 let now=1000,actors=roster();const a=clubActivities({actors:()=>actors,now:()=>now,blockedMessage:t=>t.includes('금지')});
 for(const kind of Object.keys(socialDurations))assert(a.command('a','gift-send',request({to:'b',kind})).ok);
 assert.equal(a.snapshot().socialEvents.length,3);assert(a.command('a','gift-send',request({to:'b',kind:'birthday'})).error);
 assert(a.command('a','shout-send',request({text:'금지'})).error);a.command('a','shout-send',request({text:'첫 외치기'}));a.command('b','shout-send',request({text:'두 번째'}));
 assert.equal(a.snapshot().shout.text,'첫 외치기');now=6000;assert.equal(a.snapshot().shout.text,'두 번째');now=11000;assert.equal(a.snapshot().shout,null);
 assert(a.command('a','vip-start',request()).ok);const parade=a.snapshot().parade;assert.equal(parade.count,5);assert.equal(parade.seconds,10);
 assert(a.command('b','vip-start',request()).error);a.command('c','activities-stop');assert(a.snapshot().parade);
 now+=10000;assert.equal(a.snapshot().parade,null);assert.equal(a.snapshot().socialEvents.length,0);
 a.command('a','vip-start',request());a.command('a','activities-stop');assert.equal(a.snapshot().parade,null);
 a.command('a','gift-send',request({to:'b',kind:'cake'}));actors=actors.filter(x=>x.id!=='b');assert.equal(a.snapshot().socialEvents.length,0);
});
test('all 48 palette/rounded ornament/trail/size combinations validate without ownership or prices',()=>{
 let n=0;for(const color of wandThemes)for(const [decoration]of wandDecorations)for(const [trail]of wandTrails)for(const [size]of wandSizes){const style={color:color.id,decoration,trail,size};assert(validWandStyle(style));assert.deepEqual(normalizeWandStyle(style),style);n++;}
 assert.equal(n,48);assert.equal(normalizeWandStyle({decoration:'crown'}).decoration,'cloud');assert(!validWandStyle({color:'rose',decoration:'crown',trail:'default'}));
 assert(!validWandStyle({...normalizeWandStyle(),owned:true}));assert(!validWandStyle({...normalizeWandStyle(),size:'large'}));assert.equal(normalizeWandStyle({size:'large'}).size,'default');
});
test('rounded ornaments and stronger scaled trails have finite geometry and clean up',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),tip=new B.TransformNode('tip',scene),ink=new B.StandardMaterial('ink',scene),trail=createWandTrail(B,scene);
 try{
  for(const kind of ['star','heart','cloud']){const ornament=wandOrnament(B,scene,tip,kind,ink);assert(ornament.getChildMeshes().length);assert(ornament.getChildMeshes().every(m=>!m.isPickable&&m.getVerticesData('position').every(Number.isFinite)));ornament.dispose();assert.equal(tip.getChildMeshes().length,0);}
  for(const size of [1])for(const variant of ['default','double','sparkles']){trail.setScale(size);trail.setVariant(variant);for(let i=0;i<16;i++)trail.update(new B.Vector3(Math.sin(i*.12),1+i*.02,Math.cos(i*.12)*.4),1000+i*16,1,false,3);assert(scene.meshes.filter(m=>m.visibility>0&&m.isEnabled()).length>=2);for(const m of scene.meshes)assert(m.getVerticesData('position').every(Number.isFinite));trail.reset();assert(scene.meshes.every(m=>m.visibility===0||!m.isEnabled()));}
  trail.dispose();assert.equal(scene.meshes.length,0);
 }finally{scene.dispose();engine.dispose();}
});
function model(scene,id,x=0,y=0,z=0){const root=new B.TransformNode(id,scene);root.position.set(x,y,z);const near=new B.TransformNode('near',scene);near.parent=root;const far=new B.TransformNode('far',scene);
 const body=B.MeshBuilder.CreateBox('unchanged body',{},scene);body.parent=near;const limbs=Array.from({length:4},()=>{const l=new B.TransformNode('limb',scene);l.parent=near;return l;});
 return {root,near,far,limbs,actor:{id,x,y,z,yaw:0,seat:null,wand:true},showWand(v){this.wandVisible=v;},dispose(){root.dispose();far.dispose();}};}
test('head-level hearts, held bouquet/cake, seat following, pose/wand restore and no birthday lighting',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),house=new B.HemisphericLight('unchanged house',B.Axis.Y,scene),fx=socialEffects(B,scene),models=new Map([['a',model(scene,'a')],['b',model(scene,'b',2,0,1)]]);
 house.intensity=.52;const b=models.get('b');
 try{for(const kind of ['heart','bouquet','cake']){fx.set([{id:kind,kind,from:'a',to:'b',start:1000,seconds:socialDurations[kind]}]);fx.render(2200,models);assert.equal(fx.activeCount(),1);const root=scene.getTransformNodeByName('social overlay '+kind);assert(root);
  assert(root.position.y>=1.05);if(kind==='cake'){assert.equal(b.wandVisible,false);assert.equal(b.limbs[2].rotation.x,-1.05);}if(kind==='bouquet')assert.equal(b.limbs[0].rotation.x,-1.05);
  b.root.position.y=3.8;b.actor.seat=2;fx.render(2300,models);assert(root.position.y>4.4);b.root.position.y=0;b.actor.seat=null;
  fx.render(20000,models);assert.equal(fx.activeCount(),0);assert.equal(b.limbs[0].rotation.x,0);assert.equal(b.limbs[2].rotation.x,0);assert.equal(b.root.rotation.y,0);if(kind==='cake')assert.equal(b.wandVisible,true);
 }assert.equal(scene.lights.length,1);assert.equal(house.intensity,.52);assert(!scene.meshes.some(m=>m.name.startsWith('social ')));
 }finally{scene.dispose();engine.dispose();}
});
test('shout overlay expires independently; five parade staff leave after ten seconds without touching house scene',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),house=B.MeshBuilder.CreateBox('house',{},scene);
 const renderer=clubEventRenderer(B,scene,null,a=>model(scene,a.id),{messageScreen:()=>{const mesh=B.MeshBuilder.CreatePlane('shout overlay',{},scene);mesh.material=new B.StandardMaterial('shout',scene);return mesh;}});
 try{renderer.set({shout:{id:1,text:'hello',nickname:'A',start:1000,seconds:5},parade:{id:1,start:1000,seconds:10,count:5}});renderer.render(1500);assert(renderer.hasScreen());const wings=scene.meshes.filter(m=>m.name.startsWith('shout wing '));assert.equal(wings.length,2);assert(wings[0].position.x<0&&wings[1].position.x>0);assert(wings.every(m=>Math.abs(m.position.y-edmStage.wingScreens.y)<.001));assert.equal(renderer.count(),5);assert.equal(scene.meshes.filter(m=>m.name==='VIP bottle spark').length,90);
  for(let t=0;t<=10;t+=.1)for(let i=0;i<5;i++){const p=paradePose(t,i);assert(Object.values(p).every(Number.isFinite));assert(Math.abs(p.x)<=edmFloor.width/2+1);assert(p.z>=edmFloor.minZ&&p.z<=edmFloor.maxZ+1);}
  renderer.render(6000);assert(!renderer.hasScreen());assert.equal(renderer.count(),5);renderer.render(11000);assert.equal(renderer.count(),0);assert.equal(scene.meshes.length,1);assert(!house.isDisposed());
 }finally{scene.dispose();engine.dispose();}
});
test('Colyseus handler applies customization and gifts, keeps whispers private, rejects AI targets and forged simulation',async()=>{
 process.env.CLUB_LOCAL_TEST='1';process.env.AUTH_URL='https://localhost:18801';process.env.CLUB_DB=join(mkdtempSync(join(tmpdir(),'club-activities-')),'club.sqlite');
 const {EdmRoom,rooms,connected}=await import('../app/club-room.js');const room=new EdmRoom(),handlers=new Map();room.roomId='club-activities-check';room.onMessage=(k,h)=>handlers.set(k,h);room.setSimulationInterval=room.broadcast=()=>{};room.onCreate();
 const clients=['sender','recipient','outsider'].map(sessionId=>({sessionId,messages:[],send(kind,data){this.messages.push({kind,data:structuredClone(data)});}}));
 try{for(const c of clients){room.clients.push(c);room.onJoin(c,{identity:'local-test:'+c.sessionId});}const [a,b,c]=clients;
  assert(!handlers.has('birthday-propose'));const style={color:'rose',decoration:'cloud',trail:'double',size:'default'};handlers.get('wand-style')(a,style);assert.deepEqual(room.member(a).wandStyle,style);
  handlers.get('wand-style')(a,{...style,size:'forged'});assert.deepEqual(room.member(a).wandStyle,style);
  handlers.get('gift-send')(a,request({kind:'cake',to:b.sessionId}));assert.equal(room.snapshot().socialEvents.length,1);const original=room.stageEvent;
  handlers.get('whisper-send')(a,request({to:b.sessionId,text:'비밀',from:c.sessionId,simulated:true}));
  const last=x=>x.messages.filter(m=>m.kind==='activities-state').at(-1).data;assert.equal(last(a).messages[0].from,a.sessionId);assert.equal(last(b).messages[0].simulated,false);assert.equal(last(c).messages.length,0);assert(!JSON.stringify(room.snapshot()).includes('비밀'));
  assert(b.messages.some(m=>m.kind==='whisper-notification'));assert(!c.messages.some(m=>m.kind==='whisper-notification'));
  handlers.get('whisper-block')(b,{to:a.sessionId});handlers.get('whisper-send')(a,request({to:b.sessionId,text:'차단됨'}));assert.equal(last(b).messages.length,1);
  handlers.get('gift-send')(a,request({kind:'heart',to:'ai-0'}));assert.equal(room.snapshot().socialEvents.length,1);
  handlers.get('vip-start')(a,request());handlers.get('shout-send')(a,request({text:'즐겨요'}));assert.equal(room.stageEvent,original);assert.equal(room.snapshot().parade.count,5);
  handlers.get('activities-stop')(a,{});assert.equal(room.snapshot().socialEvents.length,0);assert.equal(room.snapshot().shout,null);assert.equal(room.snapshot().parade,null);
  handlers.get('whisper-unblock')(b,{to:a.sessionId});room.removeMember(a,false);
  const rejoined={sessionId:'sender-new-session',messages:[],send(kind,data){this.messages.push({kind,data:structuredClone(data)});}};clients.push(rejoined);room.clients.push(rejoined);room.onJoin(rejoined,{identity:'local-test:sender'});
  handlers.get('whisper-send')(rejoined,request({to:b.sessionId,text:'재입장 직후'}));assert(rejoined.messages.filter(m=>m.kind==='activities-result').at(-1).data.retryAfterMs>0);

 }finally{for(const c of clients){if(room.member(c))room.removeMember(c,false);connected.delete('local-test:'+c.sessionId);}room.clock.clear();rooms.delete(room.roomId);}
});
test('birthday UI/modules retired; existing music/map/dances/floor/shows remain unchanged',()=>{
 const html=readFileSync(new URL('../app/public/edm.html',import.meta.url),'utf8');assert(!html.includes('birthday'));assert(!html.includes('생일'));
 const protectedFiles=['stage/festival/events.js','stage/festival/celebration.js','stage/festival/holograms.js','stage/festival/edm-festival.glb','app/public/ambience.js','app/public/ceiling-lights.js','app/public/rhythm-floor.js','app/public/free-dance.js','app/public/music.js','app/club-performances.js','app/edm-layout.js'];
 execFileSync('git',['diff','--exit-code','87938e1','--',...protectedFiles],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
});

test('new shout artwork pulses within its own plane; parcel gifts and both parade hands are distinct',async()=>{
 const {shoutCue}=await import('../app/public/shout-screen.js');const cues=Array.from({length:50},(_,i)=>shoutCue(i*.1));
 assert(Math.max(...cues.map(c=>c.scale))-Math.min(...cues.map(c=>c.scale))>.14);assert(cues.some(c=>c.ink===.6));assert(cues.every(c=>c.ink>=.6&&c.ink<=1));
 const engine=new B.NullEngine(),scene=new B.Scene(engine),models=new Map([['a',model(scene,'a')],['b',model(scene,'b',2,0,1)]]),fx=socialEffects(B,scene);
 const render=clubEventRenderer(B,scene,null,a=>{const m=model(scene,a.id);m.limbs[0].position.set(-.32,1.33,0);m.limbs[2].position.set(.32,1.33,0);return m;});
 try{
  fx.set([{id:'wrap',kind:'bouquet',from:'a',to:'b',start:1000,seconds:8}]);fx.render(2000,models);assert(scene.getMeshByName('social bouquet wrap'));assert.equal(scene.meshes.filter(m=>m.name==='social flower centre').length,11);assert.equal(models.get('b').wandVisible,false);
  fx.set([{id:'cake',kind:'cake',from:'a',to:'b',start:2000,seconds:8}]);fx.render(3000,models);assert.equal(scene.meshes.filter(m=>m.name==='social cake berry').length,6);assert(scene.getMeshByName('social cake top icing'));fx.stop();assert.equal(models.get('b').wandVisible,true);
  render.set({parade:{id:'hands',start:1000,seconds:10,count:5}});render.render(3000);const bottles=scene.transformNodes.filter(n=>n.name==='VIP bottle holder');assert.equal(bottles.length,10);assert(B.Vector3.Distance(bottles[0].position,bottles[1].position)>.5);
  render.stop();assert(!scene.getMeshByName('VIP beer bottle'));
 }finally{scene.dispose();engine.dispose();}
});
test('private whisper receipt tracks only its local target and is removed after 2.8s',async()=>{
 const {privateWhisperFeedback}=await import('../app/public/private-whisper-feedback.js');const engine=new B.NullEngine(),scene=new B.Scene(engine),models=new Map([['recipient',model(scene,'recipient',3,0,2)]]);
 let personalValue;const feedback=privateWhisperFeedback(B,scene,null,{balloonFactory:personal=>{personalValue=personal;return B.MeshBuilder.CreatePlane('test private receipt',{},scene);}});
 try{feedback.show('recipient',true,1000);feedback.render(1200,models);assert.equal(personalValue,true);const balloon=scene.getMeshByName('test private receipt');assert.equal(balloon.position.x,3);assert(balloon.position.y>2);
  models.get('recipient').root.position.set(5,4,2);feedback.render(1300,models);assert.equal(balloon.position.x,5);assert(balloon.position.y>6);feedback.render(3800,models);assert(!feedback.active());assert(!scene.getMeshByName('test private receipt'));
 }finally{scene.dispose();engine.dispose();}
});
