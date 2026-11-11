const defaults=['KeyS','KeyD','KeyF','Space','KeyJ','KeyK','KeyL'];
const names=code=>code==='Space'?'SPACE':code.replace(/^Key|^Digit/,'');
const weights={PERFECT:1,GREAT:.8,GOOD:.5,MISS:0};
// Scores stay in this browser. The shared track is never sought or restarted.
export function rhythmGame({music,startMusic,canPlay,lock}){
 const dialog=document.createElement('dialog');dialog.className='rhythm-dialog';
 dialog.setAttribute('aria-label','7키 리듬 게임');
 dialog.innerHTML=`<header><div><strong>7 KEY RHYTHM</strong><p>Neon Horizon · 32마디 연습</p></div><button type="button" data-close>닫기 · Esc</button></header>
 <div class="rhythm-meters"><span data-score>점수 0</span><span data-combo>콤보 0</span><span data-accuracy>정확도 —</span></div>
 <canvas tabindex="0" aria-label="노트가 아래로 내려오는 7개 레인. 표시된 건반을 판정선에서 누르세요." width="630" height="490"></canvas>
 <p class="rhythm-status" role="status">음악은 그대로 이어집니다. 연습 시작을 누르세요.</p>
 <div class="rhythm-actions"><button type="button" data-start>연습 시작</button><button type="button" data-speed>속도 · 보통</button><button type="button" data-settings>키 설정</button></div>
 <div class="rhythm-keys" hidden></div>
 <p class="rhythm-help">노트가 하단 선에 닿을 때 누르세요. PERFECT ±60ms · GREAT ±110ms · GOOD ±180ms<br>단일 노트 연습 · 점수는 개인 화면에만 표시됩니다.</p>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d'),status=$('.rhythm-status');
 const startButton=$('[data-start]'),speedButton=$('[data-speed]'),settings=$('.rhythm-keys');
 let keys=defaults.slice(),chart=null,loading=null,round=null,frame=0,speed=1,opening=false;
 let pressed=new Set(),flashes=Array(7).fill(0),judgement='',judgementUntil=0;
 const colors=['#d4b7ff','#69ddff','#d4b7ff','#ffe399','#d4b7ff','#69ddff','#d4b7ff'];
 try{const saved=JSON.parse(localStorage.getItem('edm-rhythm-keys')||'null');
  if(Array.isArray(saved)&&saved.length===7&&new Set(saved).size===7&&saved.every(k=>/^(Key[A-Z]|Digit[0-9]|Space|Arrow(Left|Right|Up|Down))$/.test(k)))keys=saved;
 }catch{}
 function setStatus(text){status.textContent=text;}
 function setupKeys(){
  settings.replaceChildren();
  const hint=document.createElement('p');hint.textContent='바꿀 건반을 누른 뒤 새 키를 입력하세요. 중복 키는 사용할 수 없습니다.';settings.append(hint);
  keys.forEach((code,lane)=>{
   const button=document.createElement('button');button.type='button';button.textContent=(lane+1)+' · '+names(code);
   button.onkeydown=e=>{
    if(e.ctrlKey||e.altKey||e.metaKey||e.code==='Escape'||e.code==='Tab')return;
    e.preventDefault();e.stopPropagation();
    if(!/^(Key[A-Z]|Digit[0-9]|Space|Arrow(Left|Right|Up|Down))$/.test(e.code))return;
    if(keys.some((k,i)=>k===e.code&&i!==lane)){setStatus('다른 레인에서 사용하는 키입니다.');return;}
    keys[lane]=e.code;button.textContent=(lane+1)+' · '+names(e.code);
    try{localStorage.setItem('edm-rhythm-keys',JSON.stringify(keys));}catch{}
   };settings.append(button);
  });
 }
 setupKeys();
 function meters(){
  if(!round)return;
  const score=Math.round(round.credit/Math.max(1,round.notes.length)*1000000);
  $('[data-score]').textContent='점수 '+score.toLocaleString('ko-KR');
  $('[data-combo]').textContent='콤보 '+round.combo+' · 최고 '+round.maxCombo;
  $('[data-accuracy]').textContent='정확도 '+(round.judged?(round.credit/round.judged*100).toFixed(1)+'%':'—');
 }
 function judge(note,label){
  note.done=true;note.result=label;round.judged++;round.credit+=weights[label];
  round.combo=label==='MISS'?0:round.combo+1;round.maxCombo=Math.max(round.maxCombo,round.combo);
  judgement=label;judgementUntil=performance.now()+450;meters();
 }
 function finish(reason,complete=false){
  if(!round?.running){if(reason)setStatus(reason);return;}
  round.running=false;pressed.clear();flashes.fill(0);
  startButton.disabled=false;speedButton.disabled=false;$('[data-settings]').disabled=false;
  startButton.textContent='다음 라운드';
  const counts=Object.keys(weights).map(k=>k+' '+round.notes.filter(n=>n.result===k).length).join(' · ');
  setStatus((complete?'라운드 완료. ':reason+' ')+counts);meters();
 }
 async function loadChart(){
  if(chart)return chart;
  loading??=fetch('/clubs/edm/neon-horizon-chart.json').then(r=>{if(!r.ok)throw Error('노트 파일을 불러오지 못했습니다.');return r.json();});
  try{const data=await loading;
   if(data.trackId!=='neon-horizon-treblo'||data.lanes!==7||!Array.isArray(data.notes)||data.notes.some(n=>!Number.isFinite(n.beat)||!Number.isInteger(n.lane)||n.lane<0||n.lane>6))throw Error('노트 패턴 형식을 확인해 주세요.');
   chart=data;return data;
  }catch(error){loading=null;throw error;}
 }
 async function begin(){
  if(opening||round?.running)return;
  if(!canPlay()){setStatus('시험 회원으로 로그인해 클럽에 연결한 뒤 시작해 주세요.');return;}
  opening=true;startButton.disabled=true;setStatus('음악과 노트를 준비하는 중…');
  try{
   const data=await loadChart();if(!dialog.open)return;
   await startMusic();if(!dialog.open)return;
   const now=music.status();if(!now.playing)throw Error('음악 시작을 눌러 소리가 재생된 뒤 다시 시작해 주세요.');
   if(now.track.id!==data.trackId)throw Error('이 패턴은 Neon Horizon 전용입니다.');
   const start=Math.ceil((now.beat+4)/4)*4,end=start+data.roundBars*4,notes=[];
   for(let cycle=Math.floor(start/data.beats);cycle<=Math.floor(end/data.beats);cycle++)
    for(const n of data.notes){const beat=cycle*data.beats+n.beat;const grid=cycle*data.beats+(n.gridBeat??n.beat);if(grid>=start&&grid<end)notes.push({...n,beat,done:false});}
   notes.sort((a,b)=>a.beat-b.beat||a.lane-b.lane);
   round={running:true,trackId:now.track.id,start,end,notes,credit:0,judged:0,combo:0,maxCombo:0,lastBeat:now.beat};
   settings.hidden=true;speedButton.disabled=true;$('[data-settings]').disabled=true;
   pressed.clear();flashes.fill(0);judgement='';meters();canvas.focus();
  }catch(error){setStatus(error.message);startButton.disabled=false;}
  finally{opening=false;if(!round?.running)startButton.disabled=false;}
 }
 function draw(){
  if(!dialog.open)return;
  const now=music.status(),W=canvas.width,H=canvas.height,top=24,bottom=H-78,left=24,width=W-48,laneWidth=width/7;
  ctx.fillStyle='#090b16';ctx.fillRect(0,0,W,H);
  const b=now.playing?now.beat:round?.lastBeat||0;
  if(round?.running){
   if(!canPlay())finish('클럽 연결이 끊겨 라운드를 중단했습니다.');
   else if(!now.playing||now.track.id!==round.trackId)finish('음악 재생 상태가 바뀌어 라운드를 중단했습니다.');
   else if(b<round.lastBeat-.3)finish('음악 위치가 바뀌어 라운드를 중단했습니다.');
   else{
    round.lastBeat=Math.max(round.lastBeat,b);
    const windowBeat=.18*now.track.bpm/60;
    for(const n of round.notes)if(!n.done&&b-n.beat>windowBeat)judge(n,'MISS');
    if(b<round.start)setStatus('준비 · '+Math.ceil(round.start-b)+'박 후 시작');
    else setStatus('진행 '+Math.min(32,Math.floor((b-round.start)/4)+1)+' / 32마디 · 음악은 그대로 이어집니다.');
    if(b>=round.end+windowBeat)finish('',true);
   }
  }
  for(let lane=0;lane<7;lane++){
   const x=left+lane*laneWidth;
   ctx.fillStyle=lane%2?'#121c2e':'#171629';ctx.fillRect(x+1,top,laneWidth-2,bottom-top);
   if(pressed.has(lane)||flashes[lane]>performance.now()){
    const gradient=ctx.createLinearGradient(0,bottom,0,bottom-170);gradient.addColorStop(0,colors[lane]+'a8');gradient.addColorStop(1,colors[lane]+'00');
    ctx.fillStyle=gradient;ctx.fillRect(x+1,bottom-170,laneWidth-2,170);
   }
   ctx.fillStyle=pressed.has(lane)?colors[lane]:'#282d43';ctx.fillRect(x+2,bottom+15,laneWidth-4,43);
   ctx.fillStyle=pressed.has(lane)?'#0a0d18':'#f4f7ff';ctx.font='bold '+(keys[lane]==='Space'?13:17)+'px system-ui';ctx.textAlign='center';
   ctx.fillText(names(keys[lane]),x+laneWidth/2,bottom+43);
  }
  ctx.strokeStyle='#edf8ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(W-left,bottom);ctx.stroke();
  const pixelsPerSecond=speed===1?200:270;
  if(round){
   for(const n of round.notes){
    if(n.done)continue;
    const y=bottom-(n.beat-b)*60/(now.track?.bpm||132)*pixelsPerSecond;
    if(y<top||y>bottom+12)continue;
    ctx.fillStyle=colors[n.lane];ctx.fillRect(left+n.lane*laneWidth+5,y-5,laneWidth-10,10);
    ctx.fillStyle='#fff';ctx.fillRect(left+n.lane*laneWidth+5,y-5,laneWidth-10,2);
   }
  }
  if(judgementUntil>performance.now()){
   ctx.textAlign='center';ctx.font='bold 29px system-ui';ctx.fillStyle=judgement==='MISS'?'#ff8c9d':'#f5faff';ctx.fillText(judgement,W/2,H*.46);
   ctx.font='bold 19px system-ui';ctx.fillText((round?.combo||0)+' COMBO',W/2,H*.46+29);
  }
  if(!round){ctx.textAlign='center';ctx.font='18px system-ui';ctx.fillStyle='#e8e8ff';ctx.fillText('7개의 건반으로 음악을 따라 연주하세요',W/2,H*.38);}
  frame=requestAnimationFrame(draw);
 }
 function keydown(e){
  if(!dialog.open||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('.rhythm-keys'))return;
  const lane=keys.indexOf(e.code);if(lane<0)return;
  if(!round?.running&&e.target.tagName==='BUTTON'&&e.code==='Space')return;
  e.preventDefault();e.stopPropagation();if(e.repeat||pressed.has(lane))return;
  pressed.add(lane);flashes[lane]=performance.now()+100;
  if(!round?.running)return;
  const now=music.status(Number.isFinite(e.timeStamp)&&e.timeStamp<1e10?e.timeStamp:performance.now());
  if(!now.playing||now.beat<round.start-.4)return;
  const note=round.notes.filter(n=>!n.done&&n.lane===lane)
   .reduce((best,n)=>!best||Math.abs(n.beat-now.beat)<Math.abs(best.beat-now.beat)?n:best,null);
  if(!note)return;
  const delta=Math.abs(note.beat-now.beat)*60/now.track.bpm*1000;
  if(delta<=180)judge(note,delta<=60?'PERFECT':delta<=110?'GREAT':'GOOD');
 }
 function release(e){const lane=keys.indexOf(e.code);if(lane>=0)pressed.delete(lane);}
 function close(){if(round?.running)finish('라운드를 종료했습니다.');dialog.close();}
 dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);pressed.clear();lock(false);document.getElementById('rhythm-open')?.focus();});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('keydown',keydown);window.addEventListener('keyup',release);
 window.addEventListener('blur',()=>{pressed.clear();if(round?.running)finish('창을 벗어나 라운드를 중단했습니다.');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&round?.running)finish('화면을 벗어나 라운드를 중단했습니다.');});
 $('[data-close]').onclick=close;startButton.onclick=begin;
 speedButton.onclick=()=>{speed=speed===1?2:1;speedButton.textContent='속도 · '+(speed===1?'보통':'빠르게');};
 $('[data-settings]').onclick=()=>{settings.hidden=!settings.hidden;};
 return {
  open(){if(dialog.open)return;lock(true);dialog.showModal();cancelAnimationFrame(frame);draw();startButton.focus();},
  interrupt(reason){if(round?.running)finish(reason);pressed.clear();},
  get active(){return dialog.open;}
 };
}
