// Reparents existing controls only. No music, animation or room commands live here.
export function clubInterface(){
 const by=id=>document.getElementById(id),main=document.querySelector('main'),footer=document.querySelector('footer'),header=document.querySelector('body > header');
 const first=by('first-actions'),frame=document.querySelector('iframe'),menus=[];
 const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
 function closeAll(except){
  for(const menu of menus)if(menu!==except)menu.open=false;
  if(except!==settings)settings.open=false;
  if(except!==developer)developer.hidden=true;
  if(except!==context)context.open=false;
 }
 function category(label,id){
  const menu=make('details','play-menu');menu.id=id;const summary=make('summary',null,label),panel=make('section','play-panel');panel.setAttribute('aria-label',label+' 메뉴');
  const heading=make('div','play-panel-heading'),title=make('strong',null,label),close=make('button','panel-close','닫기');close.type='button';close.setAttribute('aria-label',label+' 메뉴 닫기');
  heading.append(title,close);panel.append(heading);menu.append(summary,panel);menus.push(menu);
  close.onclick=()=>{menu.open=false;summary.focus();};menu.addEventListener('toggle',()=>{if(menu.open)closeAll(menu);});return {menu,panel};
 }
 const dance=category('춤','play-dance'),props=category('소품','play-props'),appearance=category('꾸미기','play-appearance'),events=category('이벤트','play-events');
 // Keep destination panels in the document while existing controls are moved by ID.
 footer.append(...menus);
 const settings=make('details','play-settings'),settingsSummary=make('summary',null,'설정'),settingsPanel=make('section','play-panel settings-panel');settingsPanel.setAttribute('aria-label','설정');settings.append(settingsSummary,settingsPanel);
 const settingsHeading=make('div','play-panel-heading');const settingsClose=make('button','panel-close','닫기');settingsClose.onclick=()=>settings.open=false;settingsHeading.append(make('strong',null,'설정·도움말'),settingsClose);settingsPanel.append(settingsHeading);
 settings.addEventListener('toggle',()=>{if(settings.open)closeAll(settings);});
 const developer=make('aside','developer-panel');developer.id='developer-panel';developer.hidden=true;developer.setAttribute('aria-label','개발용 패널');
 const developerHeading=make('div','play-panel-heading'),developerClose=make('button','panel-close','닫기');developerClose.onclick=()=>developer.hidden=true;
 developerHeading.append(make('strong',null,'개발용 패널'),developerClose);developer.append(developerHeading,make('p','panel-description','시험 버튼과 진단 정보입니다. 실행하면 현재 화면에 시험 효과가 표시됩니다.'));
 const devLaunch=make('button',null,'개발용 패널 열기');devLaunch.onclick=()=>{closeAll(developer);settings.open=false;developer.hidden=false;};
 const context=by('character-actions');context.classList.add('context-actions');context.querySelector('summary').textContent='선택한 사용자';
 const contextHeading=make('div','play-panel-heading'),contextClose=make('button','panel-close','닫기');contextClose.onclick=()=>context.open=false;contextHeading.append(make('strong',null,'캐릭터 행동'),contextClose);context.querySelector('.extra-panel').prepend(contextHeading);
 main.append(context,by('whisper-alert'),developer);
 // Keep the actual nodes (and their existing listeners) rather than duplicating actions.
 const music=by('music').parentElement;music.classList.add('music-control');header.append(music,settings);
 settingsPanel.append(by('show-guide'));
 for(const id of ['other-wands','fast-flash','quality'])settingsPanel.append(by(id).closest('label'));
 settingsPanel.append(devLaunch,document.querySelector('a[href="/lobby"]'));
 developer.append(by('population'),by('zones'),by('info'),by('particle-tests'),by('event-controls'));
 developer.append(by('channels').closest('aside'),by('shop-open'),by('shop-stop'));
 const vip=by('vip-actions');developer.append(vip.querySelector('[data-vip-preview]'),vip.querySelector('[data-vip-preview-note]'));
 developer.append(document.querySelector('[data-whisper-demo]'));
 dance.panel.append(by('dance-options'),by('pole-dance'),document.querySelector('[data-vip-solo]'));
 const danceActions=make('div','activity-buttons');danceActions.append(document.querySelector('[data-action="idle"]'),document.querySelector('[data-action="wave"]'));dance.panel.append(danceActions,make('p','panel-description','춤을 고르면 바로 시작합니다. 이동하거나 멈춤을 누르면 종료합니다.'));
 props.panel.append(by('wand'),document.querySelector('[data-vip-fan]'),by('wand-customization'));
 by('wand-customization').querySelector('summary').textContent='무드봉 색·장식·잔상';
 appearance.panel.append(by('character-customization'));
 const chooseUser=make('button',null,'사용자 선택 · 선물·귓속말');chooseUser.onclick=()=>{closeAll(context);context.open=true;};events.panel.append(chooseUser,by('shout-actions'),vip);
 vip.querySelector('#vip-personal-controls > strong').textContent='테이블 이벤트';vip.querySelector('#vip-personal-controls > p').textContent='테이블에 앉으면 미니 샴페인 타워를 켤 수 있습니다.';
 const quickDance=make('div','quick-dance'),danceName=make('span','current-dance'),quickStop=make('button','quick-dance-stop','멈춤');
 quickDance.hidden=true;danceName.setAttribute('role','status');danceName.setAttribute('aria-live','polite');quickStop.type='button';quickStop.setAttribute('aria-label','현재 춤 멈추기');
 const existingStop=document.querySelector('[data-action="idle"]');
 quickStop.onclick=()=>{existingStop.click();dance.menu.querySelector('summary').focus();};quickDance.append(danceName,quickStop);
 const danceLabels=new Map([...by('dance-options').querySelectorAll('[data-dance]')].map(button=>[button.dataset.dance,button.textContent]));
 danceLabels.set('dance','그루브');danceLabels.set('vip-solo','VIP 춤');danceLabels.set('pole-dance','봉 잡고 춤');danceLabels.set('podium-dance','보조 단상 춤');
 const contextTray=make('div','context-tray'),seatLabel=make('span','seat-context');contextTray.id='context-tray';contextTray.hidden=true;contextTray.append(quickDance,seatLabel,by('seat'),by('train-join'),by('train-leave'));main.append(contextTray);
 const rhythm=by('rhythm-open');rhythm.classList.add('rhythm-shortcut');rhythm.textContent='리듬게임';
 first.replaceChildren(...menus,rhythm);first.setAttribute('aria-label','클럽 메뉴');first.setAttribute('role','navigation');footer.replaceChildren(first);
 // Native disclosure events continue to cancel cosmetic previews when a menu closes.
 for(const [category,root]of [[appearance,by('character-customization')],[props,by('wand-customization')]]){
  category.menu.addEventListener('toggle',()=>{root.open=category===appearance&&category.menu.open;});
  root.addEventListener('toggle',()=>{if(root.open&&!category.menu.open){category.menu.open=true;closeAll(category.menu);}});
 }
 const legacyMenus=[by('shout-actions'),vip];
 events.menu.addEventListener('toggle',()=>{if(!events.menu.open)for(const root of legacyMenus)root.open=false;else if(!legacyMenus.some(root=>root.open))vip.open=true;});
 for(const root of legacyMenus)root.addEventListener('toggle',()=>{if(root.open&&!events.menu.open){events.menu.open=true;closeAll(events.menu);}});
 context.addEventListener('toggle',()=>{if(context.open)closeAll(context);});
 function closeOnScene(){for(const menu of menus)menu.open=false;settings.open=false;context.open=false;}
 frame.addEventListener('load',()=>frame.contentDocument?.addEventListener('pointerdown',closeOnScene));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){closeAll();developer.hidden=true;}});
 document.body.classList.add('play-interface');
 return {update(actor,available){
  const sitting=Boolean(actor?.seat!=null),seat=by('seat');document.body.dataset.sitting=String(sitting);
  if(sitting){const full=seat.textContent;seatLabel.textContent=full.replace(/\s*일어나기$/,'');seat.textContent='일어나기';seat.setAttribute('aria-label',full);}
  else {seatLabel.textContent='';seat.removeAttribute('aria-label');}
  const currentDance=available&&!sitting?danceLabels.get(actor?.action):null;
  quickDance.hidden=!currentDance;
  const danceText=currentDance?'현재 춤 · '+currentDance:'';if(danceName.textContent!==danceText)danceName.textContent=danceText;
  contextTray.hidden=!actor||(!currentDance&&seat.hidden&&by('train-join').hidden&&by('train-leave').hidden);chooseUser.disabled=!available;
  document.querySelector('[data-vip-solo]').hidden=document.querySelector('[data-vip-fan]').hidden=!available;
 }};
}
