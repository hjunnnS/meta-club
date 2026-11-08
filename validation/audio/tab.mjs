// Capture only the test tab's mixed playout in a separate page of the isolated browser.
import fs from 'node:fs';
import path from 'node:path';
export async function tabCapture(browser, target, out) {
 const page=await browser.newPage();
 await page.route('**/audio-recorder',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>EDM output recorder</title><body></body>'}));
 await page.goto(new URL('/audio-recorder',target.url()).href);
 await page.evaluate(()=>{document.title='EDM output recorder';document.body.replaceChildren(document.createElement('button'));document.querySelector('button').textContent='Record test tab';});
 const pcm=fs.openSync(path.join(out,'output.f32'),'w'), anchors=fs.openSync(path.join(out,'anchors.txt'),'w');
 let samples=0, previous, dropped=0;
 await page.exposeBinding('saveAudio',(_,data)=>{
   const raw=Buffer.from(data.samples,'base64');
   if(previous!==undefined&&data.frame!==previous)dropped++;
   const delta=previous===undefined?0:data.frame-previous;
   if(undefined===previous||delta)fs.writeSync(anchors,samples+' '+(data.wall).toFixed(3)+' '+(delta/48).toFixed(3)+'\n');
   fs.writeSync(pcm,raw);samples+=raw.length/4;previous=data.frame+raw.length/4;
 });
 await page.evaluate(()=>{
  document.querySelector('button').onclick=async()=>{try{
   const stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:{suppressLocalAudioPlayback:false,echoCancellation:false,noiseSuppression:false,autoGainControl:false},systemAudio:'exclude',selfBrowserSurface:'exclude'});
   if(stream.getVideoTracks()[0].getSettings().displaySurface!=='browser'||stream.getAudioTracks().length!==1)throw Error('tab audio unavailable');
   const ctx=new AudioContext({sampleRate:48000});await ctx.resume();
   const source=ctx.createMediaStreamSource(stream);
   const worklet=`class Writer extends AudioWorkletProcessor {
     constructor(){super();this.buf=new Float32Array(4800);this.count=0;}
     process(inputs){const ch=inputs[0][0];if(!ch)return true;
       for(let i=0;i<ch.length;i++){
         if(!this.count)this.start=currentFrame+i;
         this.buf[this.count++]=ch[i];
         if(this.count===this.buf.length){this.port.postMessage({frame:this.start,buf:this.buf});this.count=0;}
       }return true;
     }
   } registerProcessor('writer',Writer);`;
   await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet],{type:'text/javascript'})));
   const node=new AudioWorkletNode(ctx,'writer');source.connect(node);node.connect(ctx.destination);
   node.port.onmessage=({data})=>{
     const stamp=ctx.getOutputTimestamp(),wall=performance.timeOrigin+stamp.performanceTime+(data.frame/48000-stamp.contextTime)*1000;
     const bytes=new Uint8Array(data.buf.buffer);window.saveAudio({frame:data.frame,wall,samples:btoa(String.fromCharCode(...bytes))});
   };
   window.readyCapture={ctx,stream,node,source};
  }catch(e){window.captureFailure=String(e)}};
 });
 await page.getByText('Record test tab',{exact:true}).click();
 await page.waitForFunction(()=>window.readyCapture||window.captureFailure,null,{timeout:20000});
 const err=await page.evaluate(()=>window.captureFailure);if(err)throw Error(err);
 await target.bringToFront();
 return async()=>{await page.close();fs.closeSync(pcm);fs.closeSync(anchors);return {samples,dropped};};
}
