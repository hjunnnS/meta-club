// Bounded, local three-client server check. No external deployment or browser playback.
import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../app/package.json',import.meta.url));
globalThis.WebSocket=undefined;const {Client}=require('colyseus.js');
const {encode}=await import(pathToFileURL(require.resolve('@auth/core/jwt')));
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const directory=mkdtempSync(join(tmpdir(),'edm-shared-')),origin='https://trial.example.com',secret=randomBytes(48).toString('hex');
const codes=Array.from({length:3},()=>randomBytes(24).toString('base64url'));
const child=spawn(process.execPath,['shared-server.mjs'],{cwd:new URL('../app',import.meta.url),env:{...process.env,NODE_ENV:'production',AUTH_URL:origin,AUTH_SECRET:secret,PORT:String(port),CLUB_DB:join(directory,'club.sqlite'),CLUB_LOCAL_TEST:'0',CLUB_SHARED_TRIAL:'1',CLUB_SHARED_TRIAL_CODE_HASHES:JSON.stringify(codes.map(c=>createHash('sha256').update(c).digest('hex'))),CLUB_SHARED_TRIAL_EXPIRES_AT:new Date(Date.now()+3600000).toISOString()},stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);const rooms=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){const end=Date.now()+7000;while(!check()){if(Date.now()>end)throw Error('Timed out waiting for shared state');await delay(25);}}
function api(path,cookie,body){return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path,method:body?'POST':'GET',headers:{Host:'trial.example.com',Origin:origin,'X-Forwarded-Proto':'https',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})}},res=>{let text='';res.on('data',d=>text+=d);res.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=text;}resolve({status:res.statusCode,data});});});r.on('error',reject);if(body)r.write(JSON.stringify(body));r.end();});}
try{
 const deadline=Date.now()+10000;for(;;){try{if((await api('/healthz')).status===200)break;}catch{}if(Date.now()>deadline)throw Error('Server did not start: '+log.slice(-1500));await delay(75);}
 assert.equal((await api('/clubs/edm/admission',null,{})).status,401);
 const cookies=[];
 for(let i=1;i<=3;i++){
  const token=await encode({secret:createHmac('sha256',secret).update('meta-club/shared-trial').digest('hex'),salt:'__Secure-authjs.session-token',token:{sub:'local-test:shared-'+i},maxAge:3600}),cookie='__Secure-authjs.session-token='+token;cookies.push(cookie);
  assert.equal((await api('/api/account/profile',cookie,{nickname:'Tester '+i,avatar:['teal','rose','indigo'][i-1]})).status,200);
  const admission=await api('/clubs/edm/admission',cookie,rooms.length?{channelId:rooms[0].roomId}:{});assert.equal(admission.status,200);
  const sdk=new Client('ws://127.0.0.1:'+port,{headers:{Host:'trial.example.com',Origin:origin,Cookie:cookie}}),room=await sdk.consumeSeatReservation(admission.data.seat);
  room.snap=null;room.notifications=[];room.results=[];room.onMessage('*',(kind,data)=>{if(kind==='snapshot')room.snap=data;if(kind==='whisper-notification')room.notifications.push(data);if(kind==='activities-result')room.results.push(data);});rooms.push(room);room.send('snapshot');
 }
 await until(()=>rooms.every(r=>r.snap?.actors.filter(a=>!a.ai).length===3));
 assert.equal(new Set(rooms.map(r=>r.roomId)).size,1);assert.equal(new Set(rooms[0].snap.actors.filter(a=>!a.ai).map(a=>a.x)).size,3);
 rooms[0].send('action','side-step');await until(()=>rooms.every(r=>r.snap.actors.find(a=>a.id===rooms[0].sessionId)?.action==='side-step'));
 rooms[0].send('greeting-send',{to:rooms[1].sessionId,kind:'heart',requestId:randomUUID()});await until(()=>rooms[1].snap.greetings?.some(g=>g.from===rooms[0].sessionId&&g.to===rooms[1].sessionId&&g.kind==='heart'));
 rooms[0].send('whisper-send',{to:rooms[1].sessionId,text:'shared trial check',requestId:randomUUID()});await until(()=>rooms[1].notifications.length===1);
 assert.equal(rooms[2].notifications.length,0);assert(!JSON.stringify(rooms[2].snap).includes('shared trial check'));
 const lobby=await api('/api/lobby',cookies[0]);assert.equal(lobby.data.clubs.find(c=>c.id==='edm').channels.reduce((n,c)=>n+c.people,0),3);
 const again=await api('/clubs/edm/admission',cookies[0],{channelId:rooms[0].roomId});assert.equal(again.data.status,'already_joined');
 // Approach the existing bar seat using normal speed-limited movement.
 const {edmSeats}=await import('../app/edm-layout.js'),seat=edmSeats[0];
 await Promise.all(rooms.slice(0,2).map(async room=>{
  const start=room.snap.actors.find(a=>a.id===room.sessionId),target={x:seat.x,y:0,z:seat.z-.6},steps=Math.ceil(Math.hypot(target.x-start.x,target.z-start.z)/.65);
  for(let i=1;i<=steps;i++){await delay(200);const f=i/steps;room.send('move',{x:start.x+(target.x-start.x)*f,y:0,z:start.z+(target.z-start.z)*f,yaw:0});}
 }));
 await until(()=>rooms.slice(0,2).every(room=>{const a=room.snap.actors.find(a=>a.id===room.sessionId);return Math.hypot(a.x-seat.x,a.z-seat.z)<1.5;}));
 rooms[0].send('seat',0);await until(()=>rooms.every(r=>r.snap.actors.find(a=>a.id===rooms[0].sessionId)?.seat===0));
 rooms[1].send('seat',0);await delay(200);assert.equal(rooms[1].snap.actors.find(a=>a.id===rooms[1].sessionId).seat,null);
 rooms[0].send('stand');await until(()=>rooms.every(r=>r.snap.actors.find(a=>a.id===rooms[0].sessionId)?.seat===null));
 assert.equal((await api('/api/operator',cookies[0])).status,403);assert.equal((await api('/api/account/edm-shop',cookies[0])).status,404);
 console.log(JSON.stringify({clients:3,sameRoom:true,distinctSpawns:true,mutualActors:true,danceShared:true,targetedGreetingShared:true,whisperPrivate:true,humanCount:3,duplicatePrevented:true,seatShared:true,doubleSeatDenied:true,standShared:true,operatorDenied:true,paymentDisabled:true}));
}finally{
 await Promise.allSettled(rooms.map(r=>r.leave()));child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(2000)]);if(child.exitCode===null)child.kill('SIGKILL');rmSync(directory,{recursive:true,force:true});
}
