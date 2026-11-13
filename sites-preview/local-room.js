import {socialTrial} from './social-trial.js';
import {birthdayRequests} from './birthday-requests.js';
import {validWandStyle,normalizeWandStyle} from './wand-customization.js';
import {requestPodium,validPodiumArrival,beginPodium,clearPodium} from './podium-activity.js';
import {playlistPosition,trackBeat} from './music.js';
import {background,extraGuestPlaces} from './visitors.js';
import {edmSeats,nearbyEdmSeats,nearbyEdmPole} from './edm-layout.js';
import {dances} from './free-dance.js';
import {performanceStatus} from './club-performances.js';
import {effects} from '/stage/festival/events.js';
import {blockedMessage} from './trial-message-filter.js';
// Personal presentation adapter only. No sockets, database or shared identity.
export class PersonalRoom {
 constructor(tracks){
  this.tracks=tracks;this.epoch=Date.now();this.musicStarted=false;this.sessionId=crypto.randomUUID();this.roomId='personal';this.handlers=new Map();
  this.podiumClaims=new Map();
  this.self={id:this.sessionId,ai:false,nickname:'체험자',avatar:'indigo',x:-1.8,y:.018,z:6.4,yaw:-.08,action:'idle',seat:null,table:null,wand:false};
  this.reactive=[-1,1].map((side,i)=>({id:'ai-'+(i+3),ai:true,nickname:'AI 손님 '+(i+4),avatar:i?'rose':'teal',x:side*4,y:.018,z:1,yaw:side*.2,action:'groove',wand:true}));
  this.extra=extraGuestPlaces.map((p,i)=>({id:'floor-dancer-'+i,ai:true,nickname:'AI 손님 '+(i+6),avatar:['teal','rose','gold','indigo'][i%4],...p}));
  this.social=socialTrial(()=>[this.self,...this.ai()]);
  this.birthdays=birthdayRequests(()=>[this.self,...this.ai()],(request,sender,target)=>{
   if(blockedMessage(target.nickname)||blockedMessage(sender.nickname))return '닉네임 문구를 확인해 주세요.';
   if(this.preview&&Date.now()<this.preview.start+effects[this.preview.kind].seconds*1000)return '다른 시험 연출이 진행 중입니다. 종료 후 다시 제안해 주세요.';
   this.preview={id:request.id,kind:'led',start:Date.now(),bpm:this.tracks[0]?.bpm||132,
     message:target.nickname+'님 생일 축하합니다!',nickname:sender.nickname,socialBirthday:true};
   this.social.add('birthday',sender.id,target.id);return null;
  });
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
   socialEvents:this.social.snapshot(),personalTrial:true,waitingForMusic:!this.musicStarted,trainLeader:null,stageEvent:this.preview||show.active,nextPerformance:show.next,performanceNow:now};
 }
 publish(){
  if(this.self.action==='walk'&&Date.now()-this.lastMove>300)this.self.action='idle';
  this.emit('snapshot',this.snapshot());
 }
 send(type,data){
  const a=this.self;
  if(type==='clock'){const now=Date.now();this.emit('clock',{sent:Number.isFinite(data)?data:now,now,epoch:this.epoch,tracks:this.tracks});return;}
  if(type==='occupancy'){this.emit('occupancy',{channelId:'personal',people:1,capacity:1});return;}
  if(type==='social-stop'){this.social.stop(a.id);if(this.preview?.socialBirthday)this.preview=null;this.publish();return;}
  if(type==='birthday-incoming-demo'){
   const sender=this.ai().find(actor=>actor.id===data?.from)||this.ai()[0];
   const result=this.birthdays.propose(sender.id,a.id);if(result?.error)this.emit('notice',result.error);
   this.emit('birthday-state',{...this.birthdays.state(a.id),demo:true});return;
  }
  if(type==='birthday-state'){this.emit('birthday-state',{...this.birthdays.state(a.id),demo:true});return;}
  if(['birthday-propose','birthday-reply','birthday-demo-reply','birthday-cancel'].includes(type)){
   let result;
   if(type==='birthday-propose')result=this.birthdays.propose(a.id,data?.targetId);
   else if(type==='birthday-cancel')result=this.birthdays.cancel(a.id,data?.id);
   else if(type==='birthday-demo-reply'){
    const request=this.birthdays.state(a.id).requests.find(r=>r.id===data?.id&&r.from===a.id);
    const target=request&&this.ai().find(actor=>actor.id===request.to);
    if(!target)return;
    result=this.birthdays.answer(target.id,request.id,data?.accept);
   }else result=this.birthdays.answer(a.id,data?.id,data?.accept);
   if(result?.error)this.emit('notice',result.error);
   this.emit('birthday-state',{...this.birthdays.state(a.id),demo:true});this.publish();return;
  }
  if(type==='snapshot'){this.publish();this.emit('birthday-state',{...this.birthdays.state(a.id),demo:true});return;}
  if(type==='move'){
   if(a.seat!==null||!data||!['x','y','z','yaw'].every(k=>Number.isFinite(data[k])))return;
   const anchor=['pole-dance','podium-dance'].includes(a.action)?this.poleAnchor:null;
   if(anchor&&Math.hypot(data.x-anchor.x,data.z-anchor.z)<.08&&Math.abs(data.y-anchor.y)<.08){a.yaw=data.yaw;return;}
   if(anchor){this.poleAnchor=null;clearPodium(a);}
   const moved=Math.hypot(a.x-data.x,a.z-data.z)>.015;
   Object.assign(a,{x:data.x,y:data.y,z:data.z,yaw:data.yaw});
   if(moved){a.action='walk';this.lastMove=Date.now();}return;
  }
  if(type==='podium-request'){
   const place=requestPodium(this.podiumClaims,[a,...this.ai()],a,data?.podium,Date.now());
   if(!place){this.emit('notice','단상에 빈 자리가 없습니다. 다른 단상을 선택해 주세요.');return;}
   clearPodium(a);a.action='idle';this.poleAnchor=null;this.publish();this.emit('podium-place',place);return;
  }
  if(type==='podium-cancel'){this.podiumClaims.delete(a.id);return;}
  if(type==='podium-start'){
   if(!validPodiumArrival(this.podiumClaims,a,data,Date.now()))return;
   const position=playlistPosition(this.tracks,this.epoch,Date.now());
   const beat=trackBeat(position,0)+(position?.cycle||0)*(position?.track.duration||0)*(position?.track.bpm||132)/60;
   beginPodium(this.podiumClaims,a,data,beat);this.poleAnchor={x:a.x,y:a.y,z:a.z};this.publish();return;
  }
  if(type==='pole-grip'){
   if(a.seat!==null||a.trainSlot!=null||!data||!['x','y','z','yaw'].every(k=>Number.isFinite(data[k]))||!nearbyEdmPole({...a,...data},.95)||Math.hypot(data.x-a.x,data.y-a.y,data.z-a.z)>.5)return;
   Object.assign(a,{x:data.x,y:data.y,z:data.z,yaw:data.yaw,action:'pole-dance'});
   this.poleAnchor={x:a.x,y:a.y,z:a.z};this.publish();return;
  }
  if(type==='action'&&data==='pole-dance'){
   if(!nearbyEdmPole(a,.95)){this.emit('notice','단상 위 봉 가까이에서 시작해 주세요.');return;}
   this.poleAnchor={x:a.x,y:a.y,z:a.z};a.action=data;this.publish();return;
  }
  if(type==='action'&&a.seat===null&&(['idle','wave','dance'].includes(data)||dances.has(data))){clearPodium(a);this.podiumClaims.delete(a.id);a.action=data;this.publish();return;}
  if(type==='wand-style'){
   if(!validWandStyle(data))return;
   a.wandStyle=normalizeWandStyle(data);this.publish();return;
  }
  if(type==='wand'&&typeof data==='boolean'){
   if(data&&!a.wand)for(const ai of this.reactive)if(Math.hypot(ai.x-a.x,ai.z-a.z)<4){ai.action='disco-point';ai.until=Date.now()+2400;}
   a.wand=data;this.publish();return;
  }
  if(type==='seat'||type==='stand'){
   // Standing is idempotent: a repeated click must never sit down again.
   if(type==='stand'&&a.seat==null){this.emit('place',{...a});this.publish();return;}
   if(a.seat!==null){
    const exit=edmSeats[a.seat]?.exit||this.preSeat;if(!exit)return;
    Object.assign(a,exit,{seat:null,table:null,action:'idle'});delete a.seatMotion;this.preSeat=null;
   }else{
    if(data!==undefined&&!Number.isInteger(data))return;
    const found=nearbyEdmSeats(a).find(s=>data===undefined||s.index===data);
    if(!found){this.emit('notice','가까운 빈 의자 앞에서 앉기를 눌러 주세요.');return;}
    this.preSeat={x:a.x,y:a.y,z:a.z,yaw:a.yaw};
    if(found.seat.table||found.seat.balcony)a.seatMotion={from:{...this.preSeat},at:Date.now(),seat:found.index};
    clearPodium(a);this.podiumClaims.delete(a.id);this.poleAnchor=null;
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
 leave(){this.birthdays.leave(this.sessionId);clearInterval(this.timer);}
}
