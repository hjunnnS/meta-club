export function birthdayUI(root,send,frame){
  const list=root.querySelector('select'),targetLabel=root.querySelector('[data-birthday-target]');
  const status=root.querySelector('[data-birthday-status]'),incoming=root.querySelector('[data-birthday-incoming]');
  const propose=root.querySelector('[data-birthday-propose]'),cancel=root.querySelector('[data-birthday-cancel]');
  const demo=root.querySelector('[data-birthday-demo]'),demoPanel=root.querySelector('[data-birthday-demo-panel]');
  const pick=root.querySelector('[data-birthday-pick]');
  let roster=[],self,selected='',state={requests:[]},enabled=false,picking=false,rosterKey='';
  const stopPicking=()=>{picking=false;pick.setAttribute('aria-pressed','false');frame('birthday-picking',false);};
  const outgoing=()=>state.requests?.filter(r=>r.from===self).at(-1);
  const received=()=>state.requests?.find(r=>r.to===self&&r.status==='pending');
  function render(){
    const target=roster.find(a=>a.id===selected),out=outgoing(),request=received();
    targetLabel.textContent=target?'선택: '+target.nickname+(target.ai?' · 체험 손님':''):'대상을 선택해 주세요.';
    const waiting=out?.status==='pending';
    propose.disabled=!enabled||!target||waiting;list.disabled=!enabled||waiting;pick.disabled=!enabled||waiting;
    cancel.hidden=!waiting;
    demo.hidden=!(waiting&&state.demo===true);
    if(!waiting)demoPanel.hidden=true;
    if(out){
      const labels={pending:'상대의 수락을 기다리는 중',accepted:'수락 완료 · 전광판 축하 실행',declined:'상대가 거절했습니다. 축하는 실행되지 않습니다.',cancelled:'제안을 취소했습니다.',unavailable:'상대 또는 발신자가 클럽을 나가 제안이 종료됐습니다.',failed:out.message||'축하를 시작하지 못했습니다.'};
      status.textContent=out.target+' · '+(labels[out.status]||out.status);
    }
    incoming.hidden=!request;
    if(request)incoming.querySelector('p').textContent=request.sender+'님이 생일 축하를 제안했습니다. 수락하면 전광판에 축하 문구가 표시됩니다.';
    if(waiting&&state.demo===true)demoPanel.querySelector('p').textContent='받는 사람: '+out.target+' · '+out.sender+'님이 생일 축하를 제안했습니다. 아래 응답은 실제 사용자의 동의가 아닌 체험 조작입니다.';
  }
  function choose(id){
    if(!enabled||!roster.some(a=>a.id===id))return;
    selected=id;list.value=id;stopPicking();root.open=true;render();
  }
  list.onchange=()=>choose(list.value);
  pick.onclick=()=>{
    picking=!picking;pick.setAttribute('aria-pressed',String(picking));frame('birthday-picking',picking);
    if(picking){root.open=false;status.textContent='클럽 안의 캐릭터를 클릭해 대상을 선택하세요.';}
  };
  propose.onclick=()=>{if(propose.disabled)return;stopPicking();demoPanel.hidden=true;send('birthday-propose',{targetId:selected});};
  cancel.onclick=()=>{const out=outgoing();if(out?.status==='pending')send('birthday-cancel',{id:out.id});};
  demo.onclick=()=>{demoPanel.hidden=!demoPanel.hidden;render();};
  incoming.querySelectorAll('[data-birthday-reply]').forEach(button=>button.onclick=()=>{
    const request=received();if(request)send('birthday-reply',{id:request.id,accept:button.dataset.birthdayReply==='accept'});
  });
  demoPanel.querySelectorAll('[data-birthday-demo-reply]').forEach(button=>button.onclick=()=>{
    const out=outgoing();if(out?.status==='pending'&&state.demo===true)
      send('birthday-demo-reply',{id:out.id,accept:button.dataset.birthdayDemoReply==='accept'});
  });
  return {
    update(snapshot,available){
      enabled=Boolean(available);root.hidden=!enabled;self=snapshot?.self||self;
      if(!enabled){stopPicking();root.open=false;return;}
      roster=(snapshot?.actors||[]).filter(a=>a.id!==self&&(snapshot.personalTrial||!a.ai));
      const key=JSON.stringify(roster.map(a=>[a.id,a.nickname,a.avatar,a.ai]));
      if(key!==rosterKey){
        rosterKey=key;list.replaceChildren(new Option('사용자 목록에서 선택',''));
        const avatars={indigo:'보라',teal:'청록',rose:'분홍',gold:'노랑'};
        for(const a of roster)list.append(new Option(a.nickname+' · '+(avatars[a.avatar]||a.avatar||'캐릭터')+(a.ai?' · 체험 손님':''),a.id));
        if(!roster.some(a=>a.id===selected))selected='';list.value=selected;
      }
      render();
    },
    state(value){state=value;self=value.self||self;render();if(received()){root.open=true;stopPicking();}},
    select:choose,
    resume(){frame('birthday-picking',picking);},
  };
}
