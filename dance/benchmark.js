import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {serve} from './serve.js';
const server=await serve(), browser=await chromium.launch({channel:'chrome',headless:false,
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const data=process.argv.includes('--resume')?JSON.parse(await fs.readFile('results/frames.json','utf8')):{browser:browser.version(),at:new Date().toISOString(),runs:[]};
const smoke=process.argv.includes('--smoke');
try{
 for(let rep=0;rep<(smoke?1:3);rep++){
  const order=rep%2?['playcanvas','babylon']:['babylon','playcanvas'];
  for(const engine of order){
   const remaining=['floor','deck'].filter(view=>!data.runs.some(row=>row.repeat===rep+1&&row.engine===engine&&row.view===view));
   if(!remaining.length)continue;
   const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error(String(e)));
 page.on('console',m=>{if(m.type()==='error')console.error(m.text().slice(0,300));});
   await page.goto('http://127.0.0.1:'+server.address().port+'/?test=1&engine='+engine);
   await page.waitForFunction(()=>window.trial||window.failure,null,{timeout:90000});
   const fail=await page.evaluate(()=>window.failure);if(fail)throw Error(fail);
   for(const view of remaining){
    const row=await page.evaluate(async({view,smoke})=>{
     const t=window.trial;t.setView(view);
     const counts=[];
     for(const phase of [0,1.5,4.5])counts.push(await t.visible(phase));
     const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
     const warm=performance.now();while(performance.now()-warm<(smoke?250:4000)){await frame();t.draw((performance.now()-warm)/1000);}
     const intervals=[],submitMs=[];let initial=await frame(),last=initial;
     while(last-initial<(smoke?500:12000)){
       const cpuStart=performance.now();t.draw((last-initial)/1000);submitMs.push(performance.now()-cpuStart);const next=await frame();intervals.push(next-last);last=next;
     }
     t.draw(.6);
     return {renderer:t.renderer,width:t.width,height:t.height,msaaSamples:t.samples,engineVersion:t.version,counts,intervals,submitMs};
    },{view,smoke});
    const sorted=row.intervals.slice().sort((a,b)=>a-b);
    const percentile=p=>sorted[Math.ceil(sorted.length*p)-1];
    Object.assign(row,{engine,view,repeat:rep+1,meanFPS:1000*sorted.length/sorted.reduce((a,b)=>a+b),p95:percentile(.95),p99:percentile(.99)});
    if(!rep)await page.locator('canvas').screenshot({path:'results/'+engine+'-'+view+'.png'});
    console.log(engine,view,row.renderer,row.width,row.height,row.counts,row.meanFPS,row.p95);
    if(/SwiftShader|llvmpipe/i.test(row.renderer)||row.width!==1920||row.height!==1080)throw Error('Hardware or resolution mismatch');
    if(row.counts.some(c=>c.avatars!==60||c.ai!==5))throw Error('ID pass count outside valid range');
    data.runs.push(row);
    if(!smoke)await fs.writeFile('results/frames.json',JSON.stringify(data)+'\n');
   }
   await page.close();
  }
 }
 if(!smoke)await fs.writeFile('results/frames.json',JSON.stringify(data)+'\n');
}finally{await browser.close();server.close();}
