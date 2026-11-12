import {background,extraGuestPlaces} from './visitors.js';
import {edmSeats,nearbyEdmSeats} from './edm-layout.js';
import {dances} from './free-dance.js';
import {performanceStatus} from './club-performances.js';
import {effects} from '/stage/festival/events.js';
import {blockedMessage} from './trial-message-filter.js';
// Personal presentation adapter only. No sockets, database or shared identity.
export class PersonalRoom {
 constructor(tracks){
  this.tracks=tracks;this.epoch=Date.now();this.musicStarted=false;this.sessionId=crypto.randomUUID();this.roomId='personal';this.handlers=new Map();
  this.self={id:this.sessionId,ai:false,nickname:'체험자',avatar:'indigo',x:-1.8,y:.018,z:6.4,yaw:-.08,action:'idle',seat:null,table:null,wand:false};
  this.reactive=[-1,1].map((side,i)=>({id:'ai-'+(i+3),ai:true,nickname:'AI 손님 '+(i+4),avatar:i?'rose':'teal',x:side*4,y:.018,z:1,yaw:side*.2,action:'groove',wand:true}));
  this.extra=extraGuestPlaces.map((p,i)=>({id:'floor-dancer-'+i,ai:true,nickname:'AI 손님 '+(i+6),avatar:['teal','rose','gold','indigo'][i%4],...p}));
  this.timer=setInterval(()=>this.publish(),100);this.sequence=0;this.lastMove=0;this.preview=null;
 }
 startMusic(epoch){
  if(this.musicStarted||!Number.isFinite(epoch))return;
  this.musicStarted=true;this.epoch=epoch;
  this.send('clock',Date.now());this.publish();
 }
 onMessage(type,fn){this.handlers.set(type,fn);}
 onLeave(fn){this.onExit=fn;}
 emit(type,value){this.handlers.get(type)?.(value);}
 ai(){
  const time=(Date.now()-this.epoch)/1000;
  for(const a of this.reactive)if(a.until&&Date.now()>a.until){a.action='groove';delete a.until;}
  return [...Array.from({length:3},(_,i)=>background(i,time)),...this.reactive,...this.extra];
 }
 snapshot(){
  const now=Date.now(),show=this.musicStarted?performanceStatus(this.epoch,now,this.tracks):{active:null,next:null};
  if(this.preview&&now>=this.preview.start+effects[this.preview.kind].seconds*1000)this.preview=null;
  return {actors:[{...this.self},...this.ai().map(a=>({...a}))],zones:['OPEN','OPEN'],
   waitingForMusic:!this.musicStarted,trainLeader:null,stageEvent:this.preview||show.active,nextPerformance:show.next,performanceNow:now};
 }
 publish(){
  if(this.self.action==='walk'&&Date.now()-this.lastMove>300)this.self.action='idle';
  this.emit('snapshot',this.snapshot());
 }
 send(type,data){
  const a=this.self;
  if(type==='clock'){const now=Date.now();this.emit('clock',{sent:Number.isFinite(data)?data:now,now,epoch:this.epoch,tracks:this.tracks});return;}
  if(type==='occupancy'){this.emit('occupancy',{channelId:'personal',people:1,capacity:1});return;}
  if(type==='snapshot'){this.publish();return;}
  if(type==='move'){
   if(a.seat!==null||!data||!['x','y','z','yaw'].every(k=>Number.isFinite(data[k])))return;
   const moved=Math.hypot(a.x-data.x,a.z-data.z)>.015;
   Object.assign(a,{x:data.x,y:data.y,z:data.z,yaw:data.yaw});
   if(moved){a.action='walk';this.lastMove=Date.now();}return;
  }
  if(type==='action'&&a.seat===null&&(['idle','wave','dance'].includes(data)||dances.has(data))){a.action=data;this.publish();return;}
  if(type==='wand'&&typeof data==='boolean'){
   if(data&&!a.wand)for(const ai of this.reactive)if(Math.hypot(ai.x-a.x,ai.z-a.z)<4){ai.action='disco-point';ai.until=Date.now()+2400;}
   a.wand=data;this.publish();return;
  }
  if(type==='seat'){
   if(a.seat!==null){
    const exit=edmSeats[a.seat]?.exit||this.preSeat;if(!exit)return;
    Object.assign(a,exit,{seat:null,table:null,action:'idle'});
   }else{
    if(data!==undefined&&!Number.isInteger(data))return;
    const found=nearbyEdmSeats(a).find(s=>data===undefined||s.index===data);
    if(!found){this.emit('notice','가까운 빈 의자 앞에서 앉기를 눌러 주세요.');return;}
    this.preSeat={x:a.x,y:a.y,z:a.z,yaw:a.yaw};
    const {exit,label,balcony,area,...pose}=found.seat;Object.assign(a,pose,{seat:found.index,table:pose.table??null,action:'sit'});
   }
   this.emit('place',{...a});this.publish();return;
  }
  if(type==='preview-event'){
   if(data?.kind==='stop'){this.preview=null;this.publish();return;}
   if(!data||!Object.hasOwn(effects,data.kind))return;
   const message=String(data.message||'').trim();
   if(data.kind==='led'&&(!message||message.length>80||/[\p{Cc}\p{Cf}]/u.test(message)||blockedMessage(message))){this.emit('notice','전광판 문구를 확인해 주세요.');return;}
   this.preview={id:'personal-'+ ++this.sequence,kind:data.kind,start:Date.now(),bpm:this.tracks[0]?.bpm||132,message,nickname:'개인 체험'};
   this.publish();return;
  }
 }
 leave(){clearInterval(this.timer);}
}
