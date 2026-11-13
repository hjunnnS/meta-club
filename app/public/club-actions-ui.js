export function clubActionsUI({root,dialog,shoutRoot,vipRoot,alertButton,send,frame}){
  const list=root.querySelector('select'),targetLabel=root.querySelector('[data-action-target]'),status=root.querySelector('output');
  const pick=root.querySelector('[data-action-pick]'),conversation=dialog.querySelector('[data-whisper-log]'),input=dialog.querySelector('input');
  let roster=[],self,selected='',privateState={messages:[],blockedIds:[]},enabled=false,personal=false,picking=false,key='',peer='',lastNotice=null,stateAt=performance.now(),activityStatus={};
  const resetPick=()=>{picking=false;pick.setAttribute('aria-pressed','false');frame('action-picking',false);};
  const request=(kind,data={})=>send(kind,{...data,requestId:crypto.randomUUID()});
  const target=id=>roster.find(a=>a.id===id);
  const resultText=(element,text)=>{element.textContent=text;};
  const clock=()=>privateState.serverNow?privateState.serverNow+performance.now()-stateAt:Date.now();
  const seconds=field=>Math.max(0,Math.ceil(((privateState.cooldowns?.[field]||0)-clock())/1000));
  function renderLimits(){
    const whisper=seconds('whisperUntil'),shout=seconds('shoutUntil'),vip=seconds('paradeUntil');
    const gate=Math.max(0,Math.ceil(((activityStatus.paradeNextAt||0)-clock())/1000));
    const imminent=activityStatus.nextShowAt!=null&&activityStatus.nextShowAt-clock()<15000;
    const performing=activityStatus.showActive,parading=activityStatus.paradeActiveUntil>clock();
    const whisperHint=dialog.querySelector('[data-whisper-cooldown]');
    whisperHint.textContent=whisper?'다음 귓속말까지 '+whisper+'초':'귓속말은 2초에 한 번 보낼 수 있습니다.';
    dialog.querySelector('[data-whisper-send]').disabled=input.disabled||whisper>0;
    shoutRoot.querySelector('button[type="submit"]').disabled=shout>0;
    shoutRoot.querySelector('[data-shout-state]').textContent=(shout?'다음 외치기까지 '+shout+'초 · ':'')+(performing||parading?'공연 종료 후 순서대로 표시 · ':'')+'대기 '+(activityStatus.shoutWaiting||0)+'/3';
    vipRoot.querySelector('[data-vip-start]').disabled=vip>0||gate>0||performing||imminent||activityStatus.shoutActive;
    vipRoot.querySelector('[data-vip-state]').textContent=parading?'병 불꽃 퍼레이드 진행 중':vip>0?'내 재사용까지 '+vip+'초':gate>0?'클럽 준비까지 '+gate+'초':performing||imminent?'정기 공연 종료 후 이용해 주세요.':activityStatus.shoutActive?'외치기 표시가 끝난 뒤 이용해 주세요.':'NPC 5명 · 10초 · 개인 2분 / 클럽 종료 후 1분 간격';
  }
  function renderConversation(){
    const actor=target(peer);dialog.querySelector('[data-whisper-title]').textContent=(actor?.nickname||'상대')+' · 귓속말';
    dialog.querySelector('[data-whisper-mode]').textContent=personal?'개인 체험 · 실제 접속자와 연결되지 않습니다.':'같은 클럽의 상대에게만 전달됩니다.';
    const signature=JSON.stringify({peer,m:privateState.messages,b:privateState.blockedIds});
    if(conversation.dataset.signature!==signature){
      conversation.dataset.signature=signature;conversation.replaceChildren();
      for(const message of privateState.messages.filter(m=>m.from===self&&m.to===peer||m.to===self&&m.from===peer)){
        const line=document.createElement('p');line.textContent=(message.from===self?'나 · 보냄':message.sender)+(message.simulated?' (체험)':'')+': '+message.text;conversation.append(line);
      }
      conversation.scrollTop=conversation.scrollHeight;
    }
    const blocked=privateState.blockedIds.includes(peer);
    dialog.querySelector('[data-whisper-block]').textContent=blocked?'귓속말 차단 해제':'이 상대 귓속말 차단';
    input.disabled=!enabled||!actor||blocked;dialog.querySelector('[data-whisper-send]').disabled=input.disabled;
    dialog.querySelector('[data-whisper-block]').disabled=!enabled||!actor;
    dialog.querySelector('[data-whisper-demo]').hidden=!personal;renderLimits();
  }
  function choose(id){
    if(!enabled||!target(id))return;selected=id;list.value=id;resetPick();root.open=true;
    targetLabel.textContent='선택: '+target(id).nickname+(target(id).ai?' · 체험 손님':'');
    for(const button of root.querySelectorAll('[data-gift],[data-open-whisper]'))button.disabled=false;
  }
  function openWhisper(id){
    if(!target(id))return;peer=id;root.open=false;renderConversation();
    if(!dialog.open)dialog.showModal();frame('chat-active',true);input.focus();
    if(lastNotice?.from===id){lastNotice=null;alertButton.hidden=true;}
  }
  // These panels share one fixed screen area: opening one must not cover another.
  for(const panel of root.parentElement.querySelectorAll('details.extras'))panel.addEventListener('toggle',()=>{
    if(panel.open)for(const other of root.parentElement.querySelectorAll('details.extras'))if(other!==panel)other.open=false;
  });
  list.onchange=()=>choose(list.value);
  pick.onclick=()=>{picking=!picking;pick.setAttribute('aria-pressed',String(picking));frame('action-picking',picking);if(picking)root.open=false;};
  root.querySelectorAll('[data-gift]').forEach(button=>button.onclick=()=>{if(!enabled||!target(selected))return;status.textContent=target(selected).nickname+'님에게 선물을 보내는 중…';request('gift-send',{to:selected,kind:button.dataset.gift});});
  root.querySelector('[data-open-whisper]').onclick=()=>openWhisper(selected);
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(!input.value.trim()||input.disabled)return;request('whisper-send',{to:peer,text:input.value});};
  dialog.querySelector('[data-whisper-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>frame('chat-active',false));
  dialog.querySelector('[data-whisper-block]').onclick=()=>send(privateState.blockedIds.includes(peer)?'whisper-unblock':'whisper-block',{to:peer});
  dialog.querySelector('[data-whisper-demo]').onclick=()=>send('whisper-demo-incoming',{from:peer});
  alertButton.onclick=()=>{if(lastNotice)openWhisper(lastNotice.from);};
  shoutRoot.querySelector('form').onsubmit=event=>{event.preventDefault();const text=shoutRoot.querySelector('input').value;request('shout-send',{text});};
  vipRoot.querySelector('[data-vip-start]').onclick=()=>request('vip-start');
  vipRoot.querySelector('[data-vip-stop]').onclick=()=>send('activities-stop');
  return {
    update(snapshot,available){
      enabled=Boolean(available);root.hidden=shoutRoot.hidden=vipRoot.hidden=!enabled;self=snapshot?.self||self;personal=Boolean(snapshot?.personalTrial);
      if(!enabled){resetPick();root.open=false;dialog.close();alertButton.hidden=true;return;}
      roster=(snapshot.actors||[]).filter(a=>a.id!==self&&(personal||!a.ai));
      const nextKey=JSON.stringify(roster.map(a=>[a.id,a.nickname,a.avatar]));
      if(key!==nextKey){key=nextKey;list.replaceChildren(new Option('사용자 목록에서 선택',''));
        for(const a of roster)list.append(new Option(a.nickname+(a.ai?' · 체험 손님':''),a.id));
        if(target(selected))list.value=selected;else{selected='';targetLabel.textContent='캐릭터 또는 목록에서 대상을 선택하세요.';for(const b of root.querySelectorAll('[data-gift],[data-open-whisper]'))b.disabled=true;}
      }
      activityStatus=snapshot.activityStatus||{};
      renderConversation();
    },
    state(value){privateState=value;stateAt=performance.now();self=value.self||self;personal=value.personalTrial??personal;if(lastNotice&&value.blockedIds.includes(lastNotice.from)){lastNotice=null;alertButton.hidden=true;}renderConversation();},
    notification(value){
      if(privateState.blockedIds.includes(value.from))return;
      lastNotice=value;alertButton.textContent=value.sender+'님에게 귓속말이 왔습니다'+(value.simulated?' · 체험':'');alertButton.hidden=false;
    },
    result(value){
      const text=value.error||({ 'gift-send':'선물을 보냈습니다. 받는 사람을 확인하세요.','shout-send':value.queued?'외치기를 접수했습니다. 공연·앞선 표시가 끝나면 양옆에 5초 표시됩니다.':'양옆 전광판에 5초 표시합니다.','vip-start':'병 불꽃 퍼레이드를 시작했습니다.','activities-stop':'내 체험 이벤트를 종료했습니다.','whisper-block':'이 상대의 귓속말을 차단했습니다.','whisper-unblock':'귓속말 차단을 해제했습니다.','whisper-send':'귓속말을 보냈습니다.'})[value.kind]||'';
      if(value.kind==='whisper-send'&&value.ok){input.value='';frame('whisper-sent',{to:value.notification?.to,personal});}
      if(value.kind?.startsWith('whisper'))resultText(dialog.querySelector('output'),text);
      else if(value.kind==='shout-send')resultText(shoutRoot.querySelector('output'),text);
      else if(value.kind==='vip-start'||value.kind==='activities-stop')resultText(vipRoot.querySelector('output'),text);
      else resultText(status,text);
    },
    select:choose,
    resume(){frame('action-picking',picking);},
  };
}
