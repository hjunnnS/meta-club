export function clubActionsUI({root,dialog,shoutRoot,vipRoot,alertButton,send,frame}){
  const list=root.querySelector('select'),targetLabel=root.querySelector('[data-action-target]'),status=root.querySelector('output');
  const pick=root.querySelector('[data-action-pick]'),conversation=dialog.querySelector('[data-whisper-log]'),input=dialog.querySelector('input');
  let roster=[],self,selected='',privateState={messages:[],blockedIds:[]},enabled=false,personal=false,picking=false,key='',peer='',lastNotice=null;
  const resetPick=()=>{picking=false;pick.setAttribute('aria-pressed','false');frame('action-picking',false);};
  const request=(kind,data={})=>send(kind,{...data,requestId:crypto.randomUUID()});
  const target=id=>roster.find(a=>a.id===id);
  const resultText=(element,text)=>{element.textContent=text;};
  function renderConversation(){
    const actor=target(peer);dialog.querySelector('[data-whisper-title]').textContent=(actor?.nickname||'상대')+' · 귓속말';
    dialog.querySelector('[data-whisper-mode]').textContent=personal?'개인 체험 · 실제 접속자와 연결되지 않습니다.':'같은 클럽의 상대에게만 전달됩니다.';
    const signature=JSON.stringify({peer,m:privateState.messages,b:privateState.blockedIds});
    if(conversation.dataset.signature!==signature){
      conversation.dataset.signature=signature;conversation.replaceChildren();
      for(const message of privateState.messages.filter(m=>m.from===self&&m.to===peer||m.to===self&&m.from===peer)){
        const line=document.createElement('p');line.textContent=(message.from===self?'나':message.sender)+(message.simulated?' (체험)':'')+': '+message.text;conversation.append(line);
      }
      conversation.scrollTop=conversation.scrollHeight;
    }
    const blocked=privateState.blockedIds.includes(peer);
    dialog.querySelector('[data-whisper-block]').textContent=blocked?'귓속말 차단 해제':'이 상대 귓속말 차단';
    input.disabled=!enabled||!actor||blocked;dialog.querySelector('[data-whisper-send]').disabled=input.disabled;
    dialog.querySelector('[data-whisper-block]').disabled=!enabled||!actor;
    dialog.querySelector('[data-whisper-demo]').hidden=!personal;
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
      vipRoot.querySelector('[data-vip-start]').disabled=Boolean(snapshot.parade);
      vipRoot.querySelector('output').textContent=snapshot.parade?'병 불꽃 퍼레이드 진행 중':'이벤트 전용 NPC 5명 · 체험 기준 약 10초';
      renderConversation();
    },
    state(value){privateState=value;self=value.self||self;personal=value.personalTrial??personal;if(lastNotice&&value.blockedIds.includes(lastNotice.from)){lastNotice=null;alertButton.hidden=true;}renderConversation();},
    notification(value){
      if(privateState.blockedIds.includes(value.from))return;
      lastNotice=value;alertButton.textContent=value.sender+'님에게 귓속말이 왔습니다'+(value.simulated?' · 체험':'');alertButton.hidden=false;
    },
    result(value){
      const text=value.error||({ 'gift-send':'선물을 보냈습니다. 받는 사람을 확인하세요.','shout-send':'외치기를 접수했습니다. 순서대로 3초 표시됩니다.','vip-start':'병 불꽃 퍼레이드를 시작했습니다.','activities-stop':'내 체험 이벤트를 종료했습니다.','whisper-block':'이 상대의 귓속말을 차단했습니다.','whisper-unblock':'귓속말 차단을 해제했습니다.','whisper-send':'귓속말을 보냈습니다.'})[value.kind]||'';
      if(value.kind==='whisper-send'&&value.ok)input.value='';
      if(value.kind?.startsWith('whisper'))resultText(dialog.querySelector('output'),text);
      else if(value.kind==='shout-send')resultText(shoutRoot.querySelector('output'),text);
      else resultText(status,text);
    },
    select:choose,
    resume(){frame('action-picking',picking);},
  };
}
