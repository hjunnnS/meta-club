// One bounded check through the real public tunnel; never print invitation codes/cookies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const source=new URL('../',import.meta.url),require=createRequire(new URL('../app/package.json',import.meta.url));
globalThis.WebSocket=undefined;const {Client}=require('colyseus.js');
const runtime=JSON.parse(readFileSync(new URL('.local/mac-trial-runtime.json',source),'utf8')).root;
const state=join(runtime,'.local/shared-edm'),status=JSON.parse(readFileSync(join(state,'status.json'),'utf8')),config=JSON.parse(readFileSync(join(state,'credentials.json'),'utf8'));
const origin=new URL(status.url).origin;
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin))throw Error('Unexpected trial hostname');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){const end=Date.now()+12000;while(!check()){if(Date.now()>end)throw Error('Shared state timeout');await delay(40);}}
const sessions=[],rooms=[];
function session(){
 const cookies=new Map();
 return {cookie:()=>[...cookies].map(([k,v])=>k+'='+v).join('; '),async request(path,options={}){
  const r=await fetch(origin+path,{redirect:'manual',...options,headers:{Origin:origin,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});
  for(const line of r.headers.getSetCookie()){const pair=line.split(';',1)[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=null;}return {status:r.status,data,location:r.headers.get('location')};
 }};
}
try{
 for(let i=0;i<3;i++){
  const s=session();sessions.push(s);const csrf=await s.request('/auth/csrf');assert.equal(csrf.status,200);assert(csrf.data.csrfToken);
  const login=await s.request('/auth/callback/local-test',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({csrfToken:csrf.data.csrfToken,tester:String(i+1),accessCode:config.codes[i],callbackUrl:origin+'/clubs/edm'})});
  assert([200,302,303].includes(login.status));const who=await s.request('/api/session');assert.equal(who.data?.user?.id,'local-test:shared-'+(i+1));
  const profile=await s.request('/api/account/profile');assert.equal(profile.status,200);
  const a=await s.request('/clubs/edm/admission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rooms.length?{channelId:rooms[0].roomId}:{})});assert.equal(a.status,200);
  const sdk=new Client(origin.replace('https:','wss:'),{headers:{Origin:origin,Cookie:s.cookie()}}),room=await sdk.consumeSeatReservation(a.data.seat);
  room.snap=null;room.received=[];room.onMessage('*',(kind,data)=>{if(kind==='snapshot')room.snap=data;if(kind==='whisper-notification')room.received.push(data);});rooms.push(room);room.send('snapshot');
 }
 await until(()=>rooms.every(r=>r.snap?.actors.filter(a=>!a.ai).length===3));assert.equal(new Set(rooms.map(r=>r.roomId)).size,1);
 rooms[0].send('action','side-step');await until(()=>rooms.every(r=>r.snap.actors.find(a=>a.id===rooms[0].sessionId)?.action==='side-step'));
 rooms[0].send('greeting-send',{to:rooms[1].sessionId,kind:'heart',requestId:randomUUID()});await until(()=>rooms[1].snap.greetings?.some(g=>g.from===rooms[0].sessionId&&g.to===rooms[1].sessionId));
 rooms[0].send('whisper-send',{to:rooms[1].sessionId,text:'공동 시험 연결 확인',requestId:randomUUID()});await until(()=>rooms[1].received.length===1);assert.equal(rooms[2].received.length,0);
 const listing=await sessions[0].request('/api/lobby');assert.equal(listing.data.clubs.find(c=>c.id==='edm').channels.reduce((n,c)=>n+c.people,0),3);
 console.log(JSON.stringify({publicOrigin:origin,testers:3,realCodeLogin:true,publicWebSockets:3,sameChannel:true,mutualActors:true,danceShared:true,greetingShared:true,whisperIsolated:true,humanCount:3}));
}finally{await Promise.allSettled(rooms.map(r=>r.leave()));}
