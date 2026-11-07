import fs from 'node:fs/promises';
import path from 'node:path';

const dir=process.argv[2];
if(!dir)throw Error('Pass a completed results directory.');
const files=(await fs.readdir(dir)).filter(f=>/^\d+-\d+\.json$/.test(f)).sort((a,b)=>Number(b.split('-')[0])-Number(a.split('-')[0])||a.localeCompare(b));
const results=await Promise.all(files.map(async f=>JSON.parse(await fs.readFile(path.join(dir,f),'utf8'))));
function percentile(hist,p=.95){
  const entries=Object.entries(hist).map(([key,count])=>[Number(key),count]).sort((a,b)=>a[0]-b[0]);
  const target=Math.ceil(entries.reduce((n,[,c])=>n+c,0)*p);
  let n=0;
  for(const [key,count] of entries){n+=count;if(n>=target)return key/10;}
}
const max=(b,key)=>Math.max(...b.map(o=>o[key]));
const lines=['# EDM v3 · 10a-2 데스크톱 통합 지속 시험','',
'10a-1을 병합한 EDM v3 군무와 Colyseus 0.16.26 서버를 함께 실행했다. Babylon.js 9.35.0, 데스크톱 Chrome과 Apple M5 Pro, 1920×1080을 고정했다. CPU 1개·메모리 512MiB로 제한된 로컬 컨테이너가 20Hz로 상태를 전파한다. 실제 장면을 그리는 관측 접속 1개를 정원에 포함한다. 나머지는 같은 데스크톱 브라우저에서 각각 별도 소켓으로 입장해 150ms마다 입력을 보낸다. 서버가 3개 배경형과 2개 반응형 AI의 신호를 전파한다.','',
'서버 시작 시각과 왕복 중간점 보정으로 군무와 120 BPM 시험 음원의 기준을 맞췄다. 원격 반영은 타 세션 입력 송신부터 관측자가 해당 동작을 렌더 호출한 시점까지다. 음악 편차는 서버 기준 시각과 HTML 오디오의 재생 위치 차이다. 실제 스피커 출력 지연은 포함하지 않는다.','',
'회차마다 정원 초과 입장 거절과 10회 재입장 상태 복원을 먼저 확인했다. 5분 예열 뒤 30분 동안 1분씩 중앙·데크를 교대했다. 접속과 AI 수는 서버 상태 메시지마다 확인했다. 두 시점의 가시 인원은 예열 전과 측정 종료 직후 별도 색상 판독으로 확인했다. 음악 편차는 250ms마다 표본을 뽑았고, 120ms를 넘으면 재생 위치를 보정했다. 가입 직후와 중간 재동기화 직후 약 2.75초 시점에도 오차를 판독했다.','',
'## 결과','',
'프레임 p95는 중앙/데크 순으로 표시한다. 마지막 5분도 시점별로 집계했다. 원격 반영과 틱은 각 1분 구간 p95 중 가장 큰 값이다. 음악은 보정 전 관측된 최대 오차다.','',
'| 사용자 + AI | 회차 | 실제 측정 | 프레임 p95 (ms) | 마지막 5분 (ms) | 원격 반영 / 틱 (ms) | 음악 최대 (ms) | 준비 이상 표본 | 지속성 포함 판정 |',
'|---|---:|---:|---:|---:|---:|---:|---|'];
for(let i=0;i<results.length;i++){
 const r=results[i], b=r.buckets, h=r.frameHistograms;
 const frames=k=>[percentile(h[k+'floor']),percentile(h[k+'deck'])].map(x=>x.toFixed(1)).join(' / ');
 lines.push('| '+[r.capacity+' + 5',files[i].split('-')[1].split('.')[0],(r.actualMs/60000).toFixed(2)+'분',frames(''),frames('last5-'),max(b,'remoteP95').toFixed(1)+' / '+max(b,'tickP95').toFixed(1),max(b,'musicMax').toFixed(1),b.reduce((n,x)=>n+x.stalls,0),r.verdict.pass?'통과':Object.keys(r.verdict.checks).filter(k=>!r.verdict.checks[k]).join(', ')+' 미달'].join(' | ')+' |');
}
lines.push('','## 회차별 근거','');
for(let i=0;i<results.length;i++){
 const r=results[i],b=r.buckets,mb=bytes=>(bytes/1048576).toFixed(1),nodes=new Set(r.visibility.map(x=>x.avatars+'+'+x.ai));
 lines.push('- ['+files[i]+']('+files[i]+') · '+r.browser+' · 가시 인원 '+[...nodes].join(', ')+' · 정원 불일치 '+b.reduce((n,x)=>n+x.badRoster,0)+'회 · 예기치 않은 연결 종료 '+r.unexpected+'회 · 그래픽 컨텍스트 손실 '+r.contextLoss+'회 · 힙 '+mb(b[0].heap)+' → '+mb(b.at(-1).heap)+' MiB · 재생 위치 보정 '+r.events.length+'회 · 첫 동기화/재동기화 오차 '+r.lateError.ms.toFixed(1)+' / '+r.lastRecovery.ms.toFixed(1)+'ms.');
}
lines.push('','이 결과는 로컬 정상망과 M5 Pro 한 대의 결과다. 열화망, Windows 기준 PC, M1 MacBook Air Safari, 실제 참가자 및 모바일 기기의 정원 판정에는 적용할 수 없다. Docker 통계와 브라우저 힙을 기록했고 하드웨어 온도는 측정하지 않았다.','');
await fs.writeFile(path.join(dir,'README.md'),lines.join('\n'));
