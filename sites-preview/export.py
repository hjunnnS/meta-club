"""Export a personal browser-only presentation without changing the Colyseus app."""
from pathlib import Path
import argparse,json,re,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
arg=argparse.ArgumentParser();arg.add_argument('destination');opt=arg.parse_args()
site=Path(opt.destination).resolve();dist=site/'dist';dist.mkdir(parents=True,exist_ok=True)
def put(relative,content):
 p=dist/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
def copy(source,relative):
 p=dist/relative;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/source,p)
modules=['live-scene.js','music.js','free-dance.js','avatar.js','ceiling-lights.js','ambience.js','rhythm-floor.js','click-walk.js','scene-look.js','activity-feedback.js','rhythm-game.js','neon-horizon-chart.json']
for name in modules:copy('app/public/'+name,'clubs/edm/'+name)
# The Node server exposes live-scene.js at scene.js; preserve that public URL.
copy('app/public/live-scene.js','clubs/edm/scene.js')
copy('app/edm-layout.js','clubs/edm/edm-layout.js');copy('app/visitors.js','clubs/edm/visitors.js')
put('clubs/edm/local-room.js',(ROOT/'sites-preview/local-room.js').read_text())
put('clubs/edm/club-performances.js',(ROOT/'app/club-performances.js').read_text().replace("'./public/music.js'","'./music.js'"))
put('clubs/edm/trial-message-filter.js',(ROOT/'app/message-filter.js').read_text().replace("process.env.CHAT_BLOCKED_TERMS", "globalThis.CLUB_TRIAL_BLOCKED_TERMS"))
for name in ['events.js','celebration.js','holograms.js','edm-festival.glb']:copy('stage/festival/'+name,'stage/festival/'+name)
page=(ROOT/'stage/festival/index.html').read_text().replace("'../../dance/node_modules/babylonjs/babylon.js'","'/vendor/babylon.js'").replace("'../../dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js'","'/vendor/babylonjs.loaders.min.js'")
put('stage/festival/index.html',page)
copy('dance/node_modules/babylonjs/babylon.js','vendor/babylon.js')
copy('dance/node_modules/babylonjs-loaders/babylonjs.loaders.min.js','vendor/babylonjs.loaders.min.js')
for package in ['babylonjs','babylonjs-loaders']:
 for name in ['license.md','LICENSE','LICENSE.md']:
  f=ROOT/'dance/node_modules'/package/name
  if f.exists():copy(str(f.relative_to(ROOT)),'vendor/'+package+'-'+name);break
copy('app/fixtures/club-music/neon-horizon-treblo.mp3','media/neon-horizon-treblo.mp3')
music=(ROOT/'app/music.js').read_text();energy=json.loads(re.search(r'energySections:\s*(\[\[.*?\]\])',music,re.S).group(1))
tracks=[dict(id='neon-horizon-treblo',title='Neon Horizon · Treblo',duration=448*60/132,sourceDuration=208.728,loopStart=.23,loopEnd=.23+448*60/132,bpm=132,firstBeat=0,until=None,url='/media/neon-horizon-treblo.mp3',energySections=energy)]
put('trial/playlist.json',json.dumps(tracks,ensure_ascii=False))
html=(ROOT/'app/public/edm.html').read_text().replace('<title>EDM 클럽</title>','<title>EDM · 개인 화면 체험</title>')
html=html.replace('<h1>EDM 클럽</h1>','<h1>EDM · 개인 체험</h1>')
html=html.replace('<script src="/clubs/edm/sdk.js"></script>','')
html=re.sub(r'<dialog id="shop-dialog".*?</dialog>','',html,flags=re.S)
html=html.replace('공연 미리보기 · 시험 회원','공연 미리보기 · 개인 체험').replace('로비로 돌아가기','체험 안내')
# Personal trial has no running train. Keep server-backed club guidance untouched.
html=html.replace('무드봉을 들거나 운행 중인 기차에 합류할 수 있습니다.','무드봉을 들고 춤출 수 있습니다.')
html=html.replace('춤·무드봉·기차는','춤·무드봉은')
# Preserve the delegated button handler and all data attributes inside a native disclosure.
html=re.sub(r'<span id="particle-tests" hidden aria-label="공연 효과 시험">(.*?)</span>',
 lambda match:'<details id="particle-tests" class="trial-effects" hidden aria-label="공연 효과 시험">'
 '<summary>효과 시험</summary><div class="trial-effects-panel">'+match.group(1)+'</div></details>',html,flags=re.S)
html=html.replace('</style>','''
.trial-effects{position:relative}.trial-effects>summary{cursor:pointer;white-space:nowrap;color:#d3bfdc;padding:.34rem .75rem;border:1px solid #514360;border-radius:1rem}
.trial-effects-panel{position:absolute;right:0;top:calc(100% + .5rem);z-index:5;width:min(34rem,90vw);max-height:55dvh;overflow:auto;display:flex;flex-wrap:wrap;gap:.5rem;padding:.75rem;background:#21192b;border:1px solid #60566f;border-radius:.6rem;box-shadow:0 8px 24px #08061099}
.trial-effects:not([open])>.trial-effects-panel{display:none}
</style>''')
put('clubs/edm/index.html',html)
client=(ROOT/'app/public/channel-client.js').read_text()
client=client.replace("import { initShop } from './shop.js';","import {PersonalRoom} from './local-room.js';\nconst initShop=()=>({channel(){}});")
a=client.index('async function list()');b=client.index("window.addEventListener('message'",a)
client=client[:a]+'''async function list(){
 const select=el('channels');select.replaceChildren(new Option('개인 체험','personal'));select.value='personal';
}
async function enter(){
 if(joining||manual)return;
 if(room){room.send('snapshot');room.send('clock',Date.now());return;}
 joining=true;
 try{
  const response=await fetch('/trial/playlist.json');if(!response.ok)throw Error('음원 정보를 열 수 없습니다.');
  const tracks=await response.json();
  const next=room=new PersonalRoom(tracks);memberId='local-test:personal-'+room.sessionId;
  ready=false;needsPlace=true;snapshot=null;attempts=0;loginRequired=false;
  next.onMessage('snapshot',m=>{if(room===next)display(m);});
  next.onMessage('place',m=>{if(ready)frame('place',m);});
  next.onMessage('notice',note);
  next.onMessage('occupancy',()=>el('population').textContent='개인 체험 · AI 손님 20명');
  next.onMessage('clock',m=>{music.clock(m);if(ready)frame('clock',{offset:0,epoch:m.epoch,tracks:m.tracks});});
  next.send('snapshot');next.send('clock',Date.now());
  map.src='/stage/festival/index.html?live';map.hidden=false;
  el('retry').hidden=true;el('guide-guest').hidden=true;
  el('population').textContent='개인 체험 · AI 손님 20명';
  el('switch').closest('aside').hidden=true;
  await list();guide('entry');
 }catch(error){note(error.message);el('retry').hidden=false;}
 finally{joining=false;}
}
''' +client[b:]
client=client.replace("el('zones').textContent =\n      '사이드존 '","el('zones').textContent =\n      '체험용 전체 개방 · 사이드존 '")
client=client.replace("if (memberId?.startsWith('local-test:')) shop.channel(room.roomId, memberId);",'')
client=client.replace("  reason => { showMusic(null); firstVisitFailure(reason); },\n);", "  reason => { showMusic(null); firstVisitFailure(reason); },\n  {personalTimeline:true,countdownSeconds:3,onStart:epoch=>room?.startMusic(epoch),onCountdown:data=>{if(ready)frame('opening-countdown',data);el('music').disabled=Boolean(data)||!ready;if(data)el('music').textContent='3·2·1 준비 중';}},\n);")
client=client.replace("const countdown = next ?", "const countdown = data.waitingForMusic ? '음악 시작 후 첫 레이저 · 약 0:30' : next ?")
client=client.replace("el('music').classList.toggle('awaiting', ready && !id);", "el('music').classList.toggle('awaiting', ready && !id);el('music').disabled=!ready;")
client=client.replace("ready=false;needsPlace=true;snapshot=null;", "ready=false;el('music').disabled=true;needsPlace=true;snapshot=null;")
client=client.replace("enter(new URLSearchParams(location.search).get('channel') || undefined);", "el('music').disabled=true;enter(new URLSearchParams(location.search).get('channel') || undefined);")
put('clubs/edm/client.js',client)
landing='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>메타 클럽 · 화면 체험</title>
<style>*{box-sizing:border-box}body{margin:0;background:#100e18;color:#f2edff;font:16px system-ui;min-height:100dvh;display:grid;place-items:center}main{width:min(720px,92vw);padding:32px 20px}h1{font-size:30px}p{line-height:1.7;color:#c8c0d7}a{color:#aff7ea}.enter{display:inline-block;background:#b9f4e7;color:#11221f;padding:13px 24px;border-radius:24px;text-decoration:none;font-weight:700}section{margin:26px 0;border-top:1px solid #393044;padding:16px 0}.clubs{display:flex;gap:18px;flex-wrap:wrap}.clubs span{color:#aaa0b8}small{line-height:1.7;color:#aaa0b8}</style>
<main><h1>메타 클럽 · EDM 개인 체험</h1><p>맵을 걸어보고 춤·무드봉·공연·테이블·7키 리듬게임을 확인하세요.<br>각 방문자가 독립적으로 체험하며, 다른 접속자와 위치나 좌석을 공유하지 않습니다.</p>
<a class="enter" href="/clubs/edm/">EDM 들어가기</a>
<section><strong>조작 안내</strong><p>바닥 클릭 / WASD 이동 · 드래그로 둘러보기 · 휠로 거리 조절<br>소파를 클릭하면 걸어가 앉습니다. 하단 버튼으로 일어날 수 있습니다.<br>음악 시작 후 7키 리듬게임을 즐길 수 있습니다. 상단의 ‘효과 시험’을 펼치면 공연 시험 버튼을 사용할 수 있습니다.</p></section>
<div class="clubs"><strong>EDM · 체험 가능</strong><span>힙합 · 준비 중</span><span>소셜 라운지 · 준비 중</span><span>레트로 디스코 · 준비 중</span></div>
<p><small>데스크톱 화면 검토용 · 체험판의 구역은 둘러볼 수 있도록 열려 있습니다.<br>실제 채널 정원·공유 좌석·서버 성능을 검증하는 버전은 아닙니다.</small></p></main></html>'''
put('index.html',landing);put('lobby/index.html',landing)
put('trial/version.json',json.dumps({'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'mode':'personal-browser-only','aiGuests':20,'sharedState':False}))
(site/'README.md').write_text('EDM personal presentation export.\n\nNo credentials, server DB, Colyseus transport, private profiles or backend environment are included. Each browser has independent state.\nSource: hjunnnS/meta-club / PR #137. No additional tests or play verification performed.\n')
print('Static personal trial assets exported to '+str(dist))
