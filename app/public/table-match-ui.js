// Table-local interface only; never changes the club scene, music or camera.
export function tableMatchUI(send){
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 let state={available:false,game:null},offset=0,lastInvite=null;
 const launch=node('button','테이블 짝대기 게임'),quick=node('button','테이블 게임'),panel=node('aside');
 launch.type=quick.type='button';quick.className='table-match-quick';panel.className='table-match-panel';panel.hidden=true;quick.hidden=true;panel.setAttribute('aria-label','테이블 짝대기 게임');
 const heading=node('div'),title=node('strong','테이블 짝대기'),close=node('button','닫기'),timer=node('span'),body=node('div'),status=node('output');
 heading.className='table-match-heading';close.type='button';close.setAttribute('aria-label','테이블 게임 닫기');heading.append(title,close);panel.append(heading,timer,body,status);
 document.querySelector('#play-events .play-panel').append(launch,node('p','같은 테이블의 실제 방문객끼리 참여합니다. AI·점수·벌칙·보상은 없습니다.'));
 document.querySelector('main').append(quick,panel);
 const open=()=>{panel.hidden=false;render();};launch.onclick=quick.onclick=open;close.onclick=()=>panel.hidden=true;
 function request(action,extra={}){status.textContent='';send({action,gameId:state.game?.id,...extra});}
 function button(text,action,extra){const b=node('button',text);b.type='button';b.onclick=()=>request(action,extra);body.append(b);}
 function countdown(){const g=state.game;timer.textContent=g?.until?'남은 시간 '+Math.max(0,Math.ceil((g.until-Date.now()-offset)/1000))+'초':'';}
 function diagram(game){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 360 260');svg.setAttribute('role','img');svg.setAttribute('aria-label','참여자 선택 연결선. 서로 선택한 연결에는 하트 표시.');
  const elem=(name,attrs,text)=>{const e=document.createElementNS(svg.namespaceURI,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;};
  const positions=new Map(game.players.map((p,i)=>{const angle=-Math.PI/2+i*2*Math.PI/game.players.length;return [p.id,{x:180+Math.cos(angle)*115,y:130+Math.sin(angle)*85}];}));
  const defs=document.createElementNS(svg.namespaceURI,'defs'),marker=document.createElementNS(svg.namespaceURI,'marker'),arrow=document.createElementNS(svg.namespaceURI,'path');marker.id='table-match-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');arrow.setAttribute('d','M0 0 L10 5 L0 10 z');arrow.setAttribute('fill','#b9f4e7');marker.append(arrow);defs.append(marker);svg.append(defs);
  for(const edge of game.edges){if(edge.mutual&&edge.from>edge.to)continue;const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),attrs={x1:a.x+dx/d*23,y1:a.y+dy/d*23,x2:b.x-dx/d*23,y2:b.y-dy/d*23,stroke:edge.mutual?'#f5a6ce':'#b9f4e7','stroke-width':edge.mutual?3:2,'marker-end':'url(#table-match-arrow)'};if(edge.mutual)attrs['marker-start']='url(#table-match-arrow)';elem('line',attrs);if(edge.mutual)elem('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-8,fill:'#f5a6ce','text-anchor':'middle','font-size':22},'♥');}
  for(const p of game.players){const pos=positions.get(p.id);elem('circle',{cx:pos.x,cy:pos.y,r:20,fill:'#332a43',stroke:'#b9f4e7'});elem('text',{x:pos.x,y:pos.y+5,fill:'#f4edff','text-anchor':'middle','font-size':12},p.id===game.self?'나':String(game.players.indexOf(p)+1));elem('text',{x:pos.x,y:pos.y+36,fill:'#f4edff','text-anchor':'middle','font-size':12},p.name);}
  body.append(svg);
  for(const p of game.players){const edge=game.edges.find(e=>e.from===p.id),to=game.players.find(p=>p.id===edge?.to);body.append(node('p',p.name+' → '+(to?to.name+(edge.mutual?' ♥ 서로 선택':''):'선택 안 함')));}
 }
 function render(){
  title.textContent=state.table?state.table+' · 짝대기':'테이블 짝대기';body.replaceChildren();countdown();
  if(!state.available){body.append(node('p','1층 테이블이나 2층 소파에 앉으면 참여할 수 있습니다.'));return;}
  const g=state.game;
  if(!g){body.append(node('p','같은 테이블의 실제 방문객 '+state.people+'명 · 참여 동의 20초 → 비공개 선택 20초 → 결과 15초'));button('게임 제안','propose');body.lastChild.disabled=state.people<2;return;}
  if(g.phase==='busy'){body.append(node('p','동의한 참여자끼리 게임이 진행 중입니다. 다음 게임을 기다려 주세요.'));return;}
  body.append(node('p',g.players.map(p=>p.name+(p.id===g.self?' (나)':'')).join(' · ')));
  if(g.phase==='invite'){
   body.append(node('p',g.accepted?'참여 동의 완료 · 다른 분의 응답을 기다립니다.':'참여할까요? 동의한 사람끼리만 선택과 결과를 확인합니다.'));
   if(!g.accepted&&!g.answered){button('참여하기','join');button('이번에는 안 할게요','decline');}
   if(g.accepted)button('참여 취소','leave');return;
  }
  if(g.phase==='choose'){
   body.append(node('p','마음에 드는 상대 한 명을 골라 주세요. 선택 중에는 본인 선택만 보입니다.'));
   for(const p of g.players)if(p.id!==g.self){button(p.name+(g.chosen&&g.choice===p.id?' · 선택됨':''),'choose',{to:p.id});body.lastChild.setAttribute('aria-pressed',String(g.chosen&&g.choice===p.id));}
   button('선택하지 않고 건너뛰기','choose',{to:null});
   body.append(node('p',g.chosen?'선택을 저장했습니다. 전원이 선택하거나 시간이 끝나면 결과가 나옵니다.':'시간 안에 선택하지 않으면 건너뛰기로 처리됩니다.'));
   button('게임 나가기','leave');return;
  }
  if(g.phase==='result'){body.append(node('p','참여자에게만 보이는 결과 · 서로 선택하면 하트가 표시됩니다.'));diagram(g);button('결과 닫고 나가기','leave');}
 }
 const interval=setInterval(countdown,250);window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
 return {update(value){state=value;offset=(value.serverNow||Date.now())-Date.now();launch.disabled=!value.available;quick.hidden=!value.available;
  quick.textContent=value.game?.phase==='invite'&&!value.game.accepted&&!value.game.answered?'짝대기 초대 도착':'테이블 게임';
  if(!value.available)panel.hidden=true;
  if(value.game?.phase==='invite'&&!value.game.accepted&&!value.game.answered&&lastInvite!==value.game.id){lastInvite=value.game.id;panel.hidden=false;}
  render();},result(value){status.textContent=value.error||'';}};
}
