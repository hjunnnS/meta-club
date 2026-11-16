// Bounded, local three-client server check. No external deployment or browser playback.
import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
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
const fixture=join(directory,'table-fixture.mjs');
writeFileSync(fixture,`await import(${JSON.stringify(new URL('../app/shared-server.mjs',import.meta.url).href)});const {rooms}=await import(${JSON.stringify(new URL('../app/club-room.js',import.meta.url).href)});const {edmSeats}=await import(${JSON.stringify(new URL('../app/edm-layout.js',import.meta.url).href)});setInterval(()=>{for(const room of rooms.values()){let i=0;for(const m of room.members.values()){if(!m.fixtureSeat){const index=edmSeats.findIndex(s=>s.table===1)+i;Object.assign(m,edmSeats[index],{seat:index,table:1,action:'sit',fixtureSeat:true});room.dirty=true;}i++;}}},50);`);
const child=spawn(process.execPath,[fixture],{cwd:new URL('../app',import.meta.url),env:{...process.env,NODE_ENV:'production',AUTH_URL:origin,AUTH_SECRET:secret,PORT:String(port),CLUB_DB:join(directory,'club.sqlite'),CLUB_LOCAL_TEST:'0',CLUB_SHARED_TRIAL:'1',CLUB_SHARED_TRIAL_CODE_HASHES:JSON.stringify(codes.map(c=>createHash('sha256').update(c).digest('hex'))),CLUB_SHARED_TRIAL_EXPIRES_AT:new Date(Date.now()+3600000).toISOString()},stdio:['ignore','pipe','pipe']});
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
  room.game=null;room.history=[];room.snap=null;room.notifications=[];room.results=[];room.onMessage('*',(kind,data)=>{if(kind==='table-game-state'){room.game=data;room.history.push(data);}if(kind==='snapshot')room.snap=data;if(kind==='whisper-notification')room.notifications.push(data);if(kind==='activities-result')room.results.push(data);});rooms.push(room);room.send('snapshot');
 }
 await until(()=>rooms.every(r=>r.snap?.actors.filter(a=>!a.ai).length===3));
 await until(()=>rooms.every(r=>r.game?.available));
 const command=(i,action,extra={})=>rooms[i].send('table-game',{action,gameId:rooms[i].game?.game?.id,...extra});
 command(0,'propose');await until(()=>rooms.every(r=>r.game?.game?.phase==='invite'));
 command(1,'join');command(2,'decline');await until(()=>rooms[0].game?.game?.phase==='choose');
 command(0,'choose',{to:rooms[1].sessionId});await until(()=>rooms[0].game?.game?.chosen);
 assert.equal(rooms[1].game.game.chosen,false);assert.equal(rooms[1].game.game.edges,undefined);
 command(1,'choose',{to:rooms[0].sessionId});await until(()=>rooms[0].game?.game?.phase==='result'&&rooms[1].game?.game?.phase==='result');
 assert(rooms[0].game.game.edges.every(e=>e.mutual));assert.equal(rooms[2].game.game.edges,undefined);
 assert(rooms.every(r=>r.snap.actors.every(a=>a.tableGame===undefined)));
 assert(rooms[2].history.every(s=>s.game?.edges===undefined));
 command(1,'leave');await until(()=>rooms[0].game?.game===null);
 console.log(JSON.stringify({clients:3,consent:true,privateSelection:true,mutualResult:true,spectatorExcluded:true,noPublicSnapshotLeak:true,leaveEndsGame:true,fixture:'isolated server pre-seated actors; not navigation or browser visual QA'}));
}finally{
 await Promise.allSettled(rooms.map(r=>r.leave()));child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(2000)]);if(child.exitCode===null)child.kill('SIGKILL');rmSync(directory,{recursive:true,force:true});
}
