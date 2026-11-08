import {tabCapture} from './tab.mjs';
import {chromium} from '../node_modules/playwright-core/index.mjs';
import {serve} from '../../dance/serve.js';
import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=process.argv[2], seconds=Number(process.argv[3]||60);
const tabMode=process.argv.includes('--tab');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await fs.mkdir(out,{recursive:true});
const server=await serve();
const launch=await chromium.launchServer({channel:'chrome',headless:false,args:[...(tabMode?['--auto-select-tab-capture-source-by-title=EDM verification source']:[]),'--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
let recorder, p, stopTab;
try{
 const browser=await chromium.connect(launch.wsEndpoint());
 p=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1&engine=babylon');
 await p.waitForFunction(()=>window.trial||window.failure,null,{timeout:60000});
 await p.addScriptTag({path:path.join(root,'../node_modules/colyseus.js/dist/colyseus.js')});
 await p.addScriptTag({path:path.join(root,'../soak/client.js')});
 // Rebuild the exact PCM fixture used in the baseline.
 const wav=Buffer.alloc(44+12000*12*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
 wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(12000,24);wav.writeUInt32LE(24000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
 wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 for(let j=0;j<(wav.length-44)/2;j++){const t=j/12000;wav.writeInt16LE(Math.round(1200*Math.sin(2*Math.PI*220*t)*Math.exp(-12*(t%.5))),44+j*2);}
 await p.addScriptTag({path:path.join(root,'../soak/loop-player.js')});
 await p.evaluate(async data=>{
  document.title="EDM verification source";
  const audio=window.loopPlayer=await window.createLoopPlayer(data);
  const button=document.createElement('button');button.textContent='시험 음악 시작';button.onclick=()=>audio.play();
  document.body.append(button);
  const logs=window.audioLog=[];
  const mark=window.markAudio=(kind,extra={})=>logs.push({kind,wall:performance.timeOrigin+performance.now(),position:audio.currentTime,...extra});
  let previous=0;
  function track(){const cur=audio.currentTime;if(previous>11&&cur<.6)mark('wrap',{from:previous});previous=cur;requestAnimationFrame(track)}
  requestAnimationFrame(track);
 },wav.toString('base64'));
 await p.getByText('시험 음악 시작',{exact:true}).click();
 await sleep(600);
 if(tabMode){stopTab=await tabCapture(browser,p,out)}else{
 const parent=launch.process().pid;
 const rows=execFileSync('ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).split('\n');
 const line=rows.find(row=>{const m=row.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);return m&&Number(m[2])===parent&&m[3].includes('--utility-sub-type=audio.mojom.AudioService')});
 if(!line)throw Error('Could not identify this browser audio-service child');
 const pid=Number(line.trim().split(/\s+/)[0]);
 const fd=openSync(path.join(out,'anchors.txt'),'w');
 recorder=spawn('/tmp/edm-audio-tap',[String(pid),path.join(out,'output.f32')],{stdio:['ignore',fd,'inherit']});closeSync(fd);
 }
 let signal=false;
 for(let retry=0;retry<36&&!signal;retry++){
  await sleep(2500);
  if(recorder&&recorder.exitCode!==null)throw Error('macOS tap failed '+recorder.exitCode);
  const capture=await fs.open(path.join(out,'output.f32'),'r').catch(()=>null);
  if(!capture)continue;
  const buf=Buffer.alloc(96000);const stat=await capture.stat();await capture.read(buf,0,buf.length,Math.max(0,stat.size-buf.length));await capture.close();
  signal=buf.some(x=>x!==0);
 }
 if(!signal)throw Error('macOS capture contains no signal after 90 seconds');
 await p.evaluate(async()=>{const a=window.loopPlayer;window.markAudio('cal-stop');a.pause();await new Promise(r=>setTimeout(r,450));window.markAudio('cal-play');await a.play()});
 await p.evaluate(([warm,d])=>window.startSoak(60,warm,d),[seconds>=1800?300000:3000,seconds*1000]);
 const start=await p.evaluate(()=>performance.timeOrigin+performance.now()-window.soak.status().measuredSec*1000);
 if(process.argv.includes('--seek-probes')){
  await p.evaluate(()=>{
   const audio=window.loopPlayer;
   let lastPass=false,sham=false,seq=0;
   const timer=setInterval(()=>{
    const state=window.soak.status();
    if(state.done){clearInterval(timer);return;}
    if(state.measuredSec<0)return;
    const t=audio.currentTime;
    if(t<2){lastPass=false;sham=false;}
    if(!lastPass&&t>=3&&t<4){
     lastPass=true;const delta=seq++%2===0?.15:-.15;
     window.markAudio('probe-seek',{delta});audio.currentTime=t+delta;
    }
    if(!sham&&t>=8&&t<9){sham=true;window.markAudio('probe-sham');}
   },12);
  });
 }
 const deadline=Date.now()+seconds*1000+420000;
 while(true){
  await sleep(seconds>=1800?15000:1000);
  const state=await p.evaluate(()=>({s:window.soak.status(),err:window.soakError}));
  if(state.err||(recorder&&recorder.exitCode!==null)||Date.now()>deadline)throw Error('run interrupted '+JSON.stringify(state));
  if(state.s.done)break;
 }
 await p.evaluate(async()=>{const a=window.loopPlayer;a.currentTime=2.0;await a.play();await new Promise(r=>setTimeout(r,700));window.markAudio('end-stop');a.pause();await new Promise(r=>setTimeout(r,450));window.markAudio('end-play');await a.play();await new Promise(r=>setTimeout(r,700));});
 const result=await p.evaluate(()=>({soak:window.soak.result,events:window.audioLog}));
 result.capture=tabMode?'Chrome tab mixed playout':'macOS process output tap';
 if(stopTab){result.stream=await stopTab();stopTab=null;}
 result.start=start;result.end=start+seconds*1000;result.browser=browser.version();
 await fs.writeFile(path.join(out,'trial.json'),JSON.stringify(result));
}finally{
 if(recorder&&recorder.exitCode===null){const stopped=new Promise(r=>recorder.once('close',r));recorder.kill('SIGTERM');const deadline=setTimeout(()=>recorder.kill('SIGKILL'),4000);await stopped;clearTimeout(deadline);}
 await launch.close();server.close();
}
