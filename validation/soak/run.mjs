import {chromium} from 'playwright-core';
import {serve} from '../../dance/serve.js';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const smoke=process.argv.includes('--smoke');
const warm=smoke?5000:300000, duration=smoke?10000:1800000;
const server=await serve();
const dir=path.join(root,'results',new Date().toISOString().replaceAll(':','-')+(smoke?'-smoke':''));
await fs.mkdir(dir,{recursive:true});
const save=(name,value)=>fs.writeFile(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const wav=await fs.readFile(new URL('../../app/fixtures/g0-loop.wav', import.meta.url));
function verdict(r){
 const checks={duration:r.actualMs>=duration&&r.buckets.length===(smoke?5:30),hardware:/M5 Pro/.test(r.renderer)&&r.width===1920&&r.height===1080,
   roster:r.unexpected===0&&r.observedActors===r.capacity&&r.buckets.every(b=>b.badRoster===0&&b.beats>0&&b.maxSilence<1000),
   rendered:r.visibility.every(v=>v.avatars===r.capacity&&v.ai===5),stable:r.contextLoss===0,
   frame:r.buckets.every(b=>b.frameCount>0&&b.frameP95<=16.8),
   server:r.buckets.every(b=>b.remoteCount>0&&b.remoteP95<=200&&b.tickP95!==null&&b.tickP95<=40),
   music:r.buckets.every(b=>b.musicSamples>0&&b.musicMax<=250&&b.stalls===0)&&[r.lateError,r.lastRecovery].every(e=>e&&e.afterMs<=3000&&e.ms<=250),
   restore:r.rejoins.length===10&&Math.max(...r.rejoins)<=5000};
 return {checks,pass:Object.values(checks).every(Boolean)};
}
async function run(capacity,rep){
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 try{
 const p=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
 const faults=[];p.on('crash',()=>faults.push('crash'));p.on('pageerror',e=>faults.push(String(e)));
 const url='http://127.0.0.1:'+server.address().port+'/?test=1&engine=babylon';
 await p.goto(url);await p.waitForFunction(()=>window.trial||window.failure,null,{timeout:60000});
 await p.addScriptTag({path:path.join(root,'../node_modules/colyseus.js/dist/colyseus.js')});
 await p.addScriptTag({path:path.join(root,'client.js')});
 await p.addScriptTag({path:path.join(root,'loop-player.js')});
 await p.evaluate(async data=>{
   const audio=window.loopPlayer=await window.createLoopPlayer(data);
   const button=document.createElement('button');button.textContent='시험 음악 시작';button.onclick=()=>audio.play();
   document.body.append(button);
 },wav.toString('base64'));
 await p.getByText('시험 음악 시작',{exact:true}).click();
 await p.evaluate(([cap,w,d])=>window.startSoak(cap,w,d),[capacity,warm,duration]);
 const label=capacity+'-'+rep;
 console.log(new Date().toISOString(),label,'started');
 const resources=[];
 const deadline=Date.now()+warm+duration+90000;
 while(true){
   await wait(smoke?3000:30000);
   const info=await p.evaluate(()=>({state:window.soak?.status(),error:window.soakError,progress:window.soak?.result.buckets}));
   if(info.error||!info.state||faults.length||Date.now()>deadline)throw Error(JSON.stringify({info:info.error,state:info.state,faults}));
   if(!smoke)try{
    const docker=execFileSync('docker',['stats','--no-stream','--format','{{json .}}','meta-club-soak-room-1'],{encoding:'utf8',timeout:10000});
    resources.push({t:info.state.measuredSec,...JSON.parse(docker)});
   }catch(e){resources.push({error:e.message});}
   await save(label+'-progress.json',{state:info.state,buckets:info.progress});
   if(info.state.done)break;
 }
 const finalVisibility=await p.evaluate(async()=>{
   const counts=[];for(const view of ['floor','deck']){window.trial.setView(view);counts.push({view,...await window.trial.visible(.6)})}
   return counts;
 });
 const r=await p.evaluate(()=>window.soak.result);r.visibility.push(...finalVisibility);r.browser=browser.version();r.resources=resources;r.verdict=verdict(r);
 await save(label+'.json',r);await fs.unlink(path.join(dir,label+'-progress.json'));
 console.log(new Date().toISOString(),label,JSON.stringify(r.verdict),r.lateError,r.lastRecovery);
 return r.verdict.pass;
 }finally{await browser.close();}
}
try{
 for(const cap of (smoke?[60]:[60,50,40])){
   let passed=true;
   for(let rep=1;rep<=(smoke?1:3);rep++)if(!await run(cap,rep))passed=false;
   if(passed)break;
 }
}finally{server.close();}
