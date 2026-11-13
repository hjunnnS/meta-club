import {socialTrial} from './social-trial.js';
// Approved activity rules; prices, ownership and permanent message storage remain outside scope.
export const activityTrialRules=Object.freeze({shoutSeconds:3,shoutMaxLength:20,shoutCooldown:30000,shoutQueue:3,whisperMaxLength:200,whisperCooldown:2000,paradeSeconds:10,paradeCount:5,paradeCooldown:120000,paradeClubCooldown:60000,paradeClearance:15000});
export const activityCommands=['gift-send','whisper-send','whisper-block','whisper-unblock','shout-send','vip-start','activities-stop'];
const mainShows=new Set(['laser','phoenix','whale','dragon','jellyfish','butterflies']);
// Server instances share this store within the running service. The independent Sites adapter
// may persist only anonymous trial deadlines in its own browser; never messages or recipients.
export function activityUsage({storage=null,storageKey='club-activity-usage-v1'}={}){
 let data={users:{},gate:{activeUntil:0,nextAt:0}};
 function refresh(){try{const saved=JSON.parse(storage?.getItem(storageKey)||'null');if(saved&&saved.users&&typeof saved.users==='object'&&saved.gate)data=saved;}catch{}}
 refresh();
 return {
  get(id){refresh();return data.users[id]||{};},
  put(id,value){data.users[id]=value;},
  gate(){refresh();return data.gate;},
  setGate(value){data.gate=value;},
  persist(now){for(const [id,row]of Object.entries(data.users))if(!Object.values(row).some(t=>Number.isFinite(t)&&t>now))delete data.users[id];try{storage?.setItem(storageKey,JSON.stringify(data));}catch{}},
 };
}
export function clubActivities({actors,blockedMessage=()=>false,identity=id=>id,now=()=>Date.now(),performances=()=>({active:null,next:null}),usage=activityUsage()}){
 const rules=activityTrialRules,gifts=socialTrial(actors,now),messages=[],blocks=new Map(),seen=new Map(),queue=[];
 const instanceId=crypto.randomUUID();
 let shout=null,parade=null,sequence=0;
 const actor=id=>actors().find(a=>a.id===id),key=id=>identity(id)||id;
 const blocked=(recipient,sender)=>blocks.get(key(recipient))?.has(key(sender))===true;
 const safe=(value,max)=>typeof value==='string'&&value.trim()&&Array.from(value.trim()).length<=max&&!/[\p{Cc}\p{Cf}]/u.test(value)&&!blockedMessage(value.trim());
 const remaining=(who,kind)=>Math.max(0,(usage.get(key(who))[kind]||0)-now());
 function mark(who,kind,ms){usage.put(key(who),{...usage.get(key(who)),[kind]:now()+ms});usage.persist(now());}
 function showState(){const state=performances()||{},active=state.active;return {active:active&&mainShows.has(active.kind)&&now()>=active.start&&now()<active.start+active.seconds*1000?active:null,next:state.next};}
 function paradeEnd(at){if(!parade)return;const gate=usage.gate();if(gate.id===parade.id){usage.setGate({...gate,activeUntil:at,nextAt:at+rules.paradeClubCooldown});usage.persist(now());}parade=null;}
 function advance(){
  const time=now();
  if(parade&&(time>=parade.start+parade.seconds*1000||!actor(parade.from)))paradeEnd(Math.min(time,parade.start+parade.seconds*1000));
  const show=showState(),busy=Boolean(show.active)||usage.gate().activeUntil>time;
  if(shout&&!actor(shout.from))shout=null;
  // Scheduled starts are avoided below; an explicit show preview can still interrupt.
  // Preserve the unused display duration and resume it before later queued requests.
  if(shout&&!shout.paused&&busy){const boundary=show.active?.start??time;shout.remainingMs=Math.max(0,shout.start+shout.seconds*1000-Math.max(shout.start,boundary));shout.paused=true;}
  if(shout&&!shout.paused&&time>=shout.start+shout.seconds*1000)shout=null;
  if(shout?.paused&&shout.remainingMs<=0)shout=null;
  const free=show.next?show.next.start-time:Infinity;
  if(shout?.paused&&!busy&&free>=shout.remainingMs){shout={...shout,start:time,seconds:shout.remainingMs/1000,paused:false};}
  while(!shout&&!busy&&free>=rules.shoutSeconds*1000&&queue.length){const next=queue.shift();if(actor(next.from))shout={...next,start:time,paused:false};}
 }
 function publicStatus(){const show=showState(),gate=usage.gate();return {showActive:Boolean(show.active),nextShowAt:show.next?.start??null,paradeActiveUntil:gate.activeUntil,paradeNextAt:gate.nextAt,shoutWaiting:queue.length,shoutActive:Boolean(shout&&!shout.paused)};}
 function command(who,type,input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'요청 형식을 확인해 주세요.'};
  const sender=actor(who);if(!sender)return {error:'클럽에 다시 입장해 주세요.'};
  if(!activityCommands.includes(type))return {error:'지원하지 않는 활동입니다.'};
  advance();const target=actor(input.to);
  if(['gift-send','whisper-send','shout-send','vip-start'].includes(type)){
   if(typeof input.requestId!=='string'||!input.requestId||input.requestId.length>80)return {error:'요청을 확인해 주세요.'};
   const id=key(who)+':'+type+':'+input.requestId;if(seen.has(id))return {duplicate:true};
   const remember=()=>{seen.set(id,true);while(seen.size>256)seen.delete(seen.keys().next().value);};
   const limited=(kind,label)=>{const retryAfterMs=remaining(who,kind);return retryAfterMs?{error:label+' · '+Math.ceil(retryAfterMs/1000)+'초 후 다시 이용해 주세요.',retryAfterMs}:null;};
   if(type==='gift-send'){
    if(!target||target.id===who||!['heart','bouquet','cake'].includes(input.kind))return {error:'다른 클럽 손님을 선택해 주세요.'};
    remember();gifts.add(input.kind,who,target.id);return {ok:true,to:target.id};
   }
   if(type==='whisper-send'){
    if(!target||target.id===who)return {error:'같은 클럽의 다른 상대를 선택해 주세요.'};
    if(blocked(target.id,who)||blocked(who,target.id))return {error:'이 상대와 귓속말을 주고받을 수 없습니다.'};
    if(!safe(input.text,rules.whisperMaxLength))return {error:'귓속말 내용을 확인해 주세요.'};
    const limit=limited('whisperUntil','귓속말은 2초에 한 번 보낼 수 있습니다');if(limit)return limit;
    remember();mark(who,'whisperUntil',rules.whisperCooldown);
    const message={id:'whisper-'+ ++sequence,from:who,to:target.id,sender:sender.nickname,recipient:target.nickname,text:input.text.trim(),at:now(),simulated:input.simulated===true};
    messages.push(message);while(messages.length>200)messages.shift();
    return {ok:true,notification:{to:target.id,from:who,sender:sender.nickname,simulated:message.simulated}};
   }
   if(type==='shout-send'){
    if(!safe(input.text,rules.shoutMaxLength)||!safe(sender.nickname,40))return {error:'외치기는 20자 이내의 허용 문구를 입력해 주세요.'};
    const limit=limited('shoutUntil','외치기는 30초에 한 번 이용할 수 있습니다');if(limit)return limit;
    if(queue.length>=rules.shoutQueue)return {error:'외치기 대기 3건이 가득 찼습니다. 잠시 후 다시 시도해 주세요.'};
    remember();mark(who,'shoutUntil',rules.shoutCooldown);const request={id:'shout-'+ ++sequence,from:who,nickname:sender.nickname,text:input.text.trim(),seconds:rules.shoutSeconds};queue.push(request);advance();return {ok:true,queued:shout?.id!==request.id};
   }
   const ownLimit=limited('paradeUntil','퍼레이드는 2분에 한 번 이용할 수 있습니다');if(ownLimit)return ownLimit;
   const gate=usage.gate();
   if(parade||gate.activeUntil>now())return {error:'퍼레이드가 진행 중입니다. 끝난 뒤 다시 이용해 주세요.'};
   if(gate.nextAt>now())return {error:'클럽 퍼레이드 준비 중 · '+Math.ceil((gate.nextAt-now())/1000)+'초 후 다시 이용해 주세요.',retryAfterMs:gate.nextAt-now()};
   const show=showState();
   if(show.active||show.next&&show.next.start-now()<rules.paradeClearance)return {error:'정기 공연을 준비하거나 진행 중입니다. 공연 종료 후 다시 이용해 주세요.'};
   if(shout&&!shout.paused)return {error:'외치기 표시가 끝난 뒤 다시 이용해 주세요.'};
   remember();mark(who,'paradeUntil',rules.paradeCooldown);
   parade={id:'parade-'+instanceId+'-'+ ++sequence,from:who,start:now(),seconds:rules.paradeSeconds,count:rules.paradeCount};usage.setGate({id:parade.id,activeUntil:now()+rules.paradeSeconds*1000,nextAt:now()+rules.paradeSeconds*1000+rules.paradeClubCooldown});usage.persist(now());return {ok:true};
  }
  if(type==='whisper-block'||type==='whisper-unblock'){
   if(!target||target.id===who)return {error:'차단할 상대를 선택해 주세요.'};
   if(!blocks.has(key(who)))blocks.set(key(who),new Set());
   if(type==='whisper-block')blocks.get(key(who)).add(key(target.id));else blocks.get(key(who)).delete(key(target.id));return {ok:true};
  }
  gifts.stop(who);for(let i=queue.length-1;i>=0;i--)if(queue[i].from===who)queue.splice(i,1);
  if(shout?.from===who)shout=null;if(parade?.from===who)paradeEnd(now());advance();return {ok:true};
 }
 return {
  command,
  snapshot(){advance();return {socialEvents:gifts.snapshot(),shout:shout&&!shout.paused?{...shout}:null,parade:parade?{...parade}:null,activityStatus:publicStatus()};},
  view(who){return {self:who,serverNow:now(),cooldowns:{...usage.get(key(who))},messages:messages.filter(m=>m.from===who||m.to===who).map(m=>({...m})),blockedIds:actors().filter(a=>blocked(who,a.id)).map(a=>a.id)};},
  leave(who){gifts.stop(who);for(let i=queue.length-1;i>=0;i--)if(queue[i].from===who)queue.splice(i,1);if(parade?.from===who)paradeEnd(now());if(shout?.from===who)shout=null;},
 };
}
