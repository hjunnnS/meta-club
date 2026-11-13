import {socialTrial} from './social-trial.js';
// Adjustable presentation defaults for the no-payment trial, not sales policies.
export const activityTrialRules=Object.freeze({shoutSeconds:3,shoutMaxLength:20,whisperMaxLength:200,paradeSeconds:10,paradeCount:5});
export const activityCommands=['gift-send','whisper-send','whisper-block','whisper-unblock','shout-send','vip-start','activities-stop'];
export function clubActivities({actors,blockedMessage=()=>false,identity=id=>id,now=()=>Date.now()}){
  const gifts=socialTrial(actors,now),messages=[],blocks=new Map(),seen=new Map(),queue=[];
  let shout=null,parade=null,sequence=0;
  const actor=id=>actors().find(a=>a.id===id);
  const key=id=>identity(id)||id;
  const blocked=(recipient,sender)=>blocks.get(key(recipient))?.has(key(sender))===true;
  const safe=(value,max)=>typeof value==='string'&&value.trim()&&Array.from(value.trim()).length<=max&&!/[\p{Cc}\p{Cf}]/u.test(value)&&!blockedMessage(value.trim());
  function advance(){
    if(shout&&(now()>=shout.start+shout.seconds*1000||!actor(shout.from)))shout=null;
    while(!shout&&queue.length){const next=queue.shift();if(actor(next.from))shout={...next,start:now()};}
    if(parade&&(now()>=parade.start+parade.seconds*1000||!actor(parade.from)))parade=null;
  }
  function command(who,type,input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))return {error:'요청 형식을 확인해 주세요.'};
    const sender=actor(who);if(!sender)return {error:'클럽에 다시 입장해 주세요.'};
    if(!activityCommands.includes(type))return {error:'지원하지 않는 활동입니다.'};
    advance();const target=actor(input?.to);
    if(['gift-send','whisper-send','shout-send','vip-start'].includes(type)){
      if(typeof input?.requestId!=='string'||!input.requestId||input.requestId.length>80)return {error:'요청을 확인해 주세요.'};
      const id=who+':'+type+':'+input.requestId;if(seen.has(id))return {duplicate:true};
      // Remember only accepted requests. Rejected requests can be corrected.
      const remember=()=>{seen.set(id,true);while(seen.size>256)seen.delete(seen.keys().next().value);};
      if(type==='gift-send'){
        if(!target||target.id===who||!['heart','bouquet','cake'].includes(input.kind))return {error:'다른 클럽 손님을 선택해 주세요.'};
        remember();gifts.add(input.kind,who,target.id);return {ok:true,to:target.id};
      }
      if(type==='whisper-send'){
        if(!target||target.id===who)return {error:'같은 클럽의 다른 상대를 선택해 주세요.'};
        if(blocked(target.id,who)||blocked(who,target.id))return {error:'이 상대와 귓속말을 주고받을 수 없습니다.'};
        if(!safe(input.text,activityTrialRules.whisperMaxLength))return {error:'귓속말 내용을 확인해 주세요.'};
        remember();const message={id:'whisper-'+ ++sequence,from:who,to:target.id,sender:sender.nickname,recipient:target.nickname,text:input.text.trim(),at:now(),simulated:input.simulated===true};
        messages.push(message);while(messages.length>200)messages.shift();
        return {ok:true,notification:{to:target.id,from:who,sender:sender.nickname,simulated:message.simulated}};
      }
      if(type==='shout-send'){
        if(!safe(input.text,activityTrialRules.shoutMaxLength)||!safe(sender.nickname,40))return {error:'외치기는 체험 기준 20자 이내의 허용 문구를 입력해 주세요.'};
        if(queue.length>=20)return {error:'외치기가 많습니다. 잠시 후 다시 시도해 주세요.'};
        remember();queue.push({id:'shout-'+ ++sequence,from:who,nickname:sender.nickname,text:input.text.trim(),seconds:activityTrialRules.shoutSeconds});advance();return {ok:true};
      }
      if(parade)return {error:'퍼레이드가 진행 중입니다. 끝난 뒤 다시 시작해 주세요.'};
      remember();parade={id:'parade-'+ ++sequence,from:who,start:now(),seconds:activityTrialRules.paradeSeconds,count:activityTrialRules.paradeCount};return {ok:true};
    }
    if(type==='whisper-block'||type==='whisper-unblock'){
      if(!target||target.id===who)return {error:'차단할 상대를 선택해 주세요.'};
      if(!blocks.has(key(who)))blocks.set(key(who),new Set());
      if(type==='whisper-block')blocks.get(key(who)).add(key(target.id));else blocks.get(key(who)).delete(key(target.id));
      return {ok:true};
    }
    gifts.stop(who);for(let i=queue.length-1;i>=0;i--)if(queue[i].from===who)queue.splice(i,1);
    if(shout?.from===who)shout=null;if(parade?.from===who)parade=null;advance();return {ok:true};
  }
  return {
    command,
    snapshot(){advance();return {socialEvents:gifts.snapshot(),shout:shout?{...shout}:null,parade:parade?{...parade}:null};},
    view(who){return {self:who,messages:messages.filter(m=>m.from===who||m.to===who).map(m=>({...m})),blockedIds:actors().filter(a=>blocked(who,a.id)).map(a=>a.id)};},
    leave(who){gifts.stop(who);if(parade?.from===who)parade=null;if(shout?.from===who)shout=null;advance();},
  };
}
