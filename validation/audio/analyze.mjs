import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2], sr=48000;
const r=JSON.parse(fs.readFileSync(path.join(dir,'trial.json')));
const anchors=fs.readFileSync(path.join(dir,'anchors.txt'),'utf8').trim().split('\n').map(s=>s.trim().split(/\s+/).map(Number));
const blobs=fs.createReadStream(path.join(dir,'output.f32'),{highWaterMark:48000*4});
const gaps=[], onsets=[];
let low=true;
let sample=0,anchorIndex=0,quietStart=null,peak=0;

for await(const data of blobs){
 const values=new Float32Array(data.buffer,data.byteOffset,data.length/4);
 for(const x of values){
  peak=Math.max(peak,Math.abs(x));sample++;
  if(sample%240===0){
   while(anchorIndex+1<anchors.length&&anchors[anchorIndex+1][0]<=sample-240)anchorIndex++;
   const [base,wall]=anchors[anchorIndex];
   const time=wall+(sample-240-base)*1000/sr;

   if(peak<0.006)low=true;
   if(low&&peak>0.018){onsets.push(time);low=false;}
   if(peak<0.000008){if(quietStart===null)quietStart=time;}
   else if(quietStart!==null){if(time-quietStart>=9.9)gaps.push({start:quietStart,end:time,ms:time-quietStart});quietStart=null;}
   peak=0;
  }
 }
}
const cal=r.events.find(e=>e.kind==='cal-stop');
const resume=r.events.find(e=>e.kind==='cal-play');
function calibration(stop,play){
 const match=gaps.filter(g=>g.end>stop.wall-200&&g.start<play.wall+400).sort((a,b)=>Math.abs(a.ms-(play.wall-stop.wall))-Math.abs(b.ms-(play.wall-stop.wall)))[0];
 if(!match||match.ms<250||match.ms>650)throw Error('Unresolved calibration gap: '+JSON.stringify(gaps.slice(0,6)));
 return {wall:stop.wall,commandMs:play.wall-stop.wall,measuredMs:match.ms,offsetMs:match.end-play.wall};
}
const last=calibration(r.events.find(e=>e.kind==='end-stop'),r.events.find(e=>e.kind==='end-play'));
const partial=process.argv.includes('--overlap');
const first=partial?{...last,wall:anchors[0][1]}:calibration(cal,resume);
if(partial)r.start=Math.max(r.start,anchors[0][1]+2000);
const offsetAt=wall=>first.offsetMs+(last.offsetMs-first.offsetMs)*(wall-first.wall)/(last.wall-first.wall);
const aligned=e=>e.wall+offsetAt(e.wall);
const assignments=r.events.filter(e=>e.kind==='correction');
const events=r.events.filter(e=>{
 if(!['wrap','correction'].includes(e.kind)||e.wall<r.start||e.wall>=r.end)return false;
 if(e.kind==='wrap'&&assignments.some(s=>s.position>11&&s.target<.6&&s.wall<=e.wall&&s.wall>=e.wall-100))return false;
 return true;
});
const captureFaults=anchors.slice(1).filter(a=>a[1]>=aligned({wall:r.start})&&a[1]<aligned({wall:r.end}));
const candidates=gaps.filter(g=>g.start>=aligned({wall:r.start})&&g.end<aligned({wall:r.end}));
const active=candidates.filter(g=>!captureFaults.some(a=>a[1]>=g.start-250&&a[1]<=g.end+250));
const observations=active.map(g=>{
 const nearest=events.reduce((a,e)=>!a||Math.abs(aligned(e)-g.start)<Math.abs(aligned(a)-g.start)?e:a,null);
 const delta=g.start-aligned(nearest);
 const nearby=events.filter(e=>g.start<=aligned(e)+250&&g.end>=aligned(e)-250).map(e=>e.kind);
 return {wall:g.start,nearby:[...new Set(nearby)],atSec:(g.start-r.start-offsetAt(r.start))/1000,ms:g.ms,nearest:nearest.kind,deltaMs:delta,associated:Math.abs(delta)<=250};
});
const covered=events.map(e=>({kind:e.kind,atSec:(e.wall-r.start)/1000,
 gap:active.some(g=>g.start<=aligned(e)+250&&g.end>=aligned(e)-250)}));
const groups=Object.fromEntries(['wrap','correction'].map(kind=>{
 const occurrences=events.filter((e,i)=>e.kind===kind&&!events.slice(0,i).some(other=>other.kind===kind&&e.wall-other.wall<5));
 const isolated=occurrences.filter(e=>!events.some(other=>other.kind!==kind&&Math.abs(other.wall-e.wall)<=500));
 const hit=e=>active.some(g=>g.start<=aligned(e)+250&&g.end>=aligned(e)-250);
 return [kind,{clusters:occurrences.length,isolated:isolated.length,isolatedWithGap:isolated.filter(hit).length}];
}));
const counts=Object.fromEntries(['wrap','correction'].map(k=>[k,{total:covered.filter(e=>e.kind===k).length,withGap:covered.filter(e=>e.kind===k&&e.gap).length}]));
const metrics={capture:r.capture,seconds:(r.end-r.start)/1000,partial,calibration:{first,last},
 groups,measuredCaptureFaults:captureFaults.length,excludedGaps:candidates.length-active.length,anchors:anchors.length,captureDiscontinuities:anchors.slice(1),stream:r.stream,events:counts,gaps:observations,covered,
 load:{capacity:r.soak.capacity,actors:r.soak.observedActors,unexpected:r.soak.unexpected,badRoster:r.soak.buckets.reduce((n,b)=>n+b.badRoster,0),visible:r.soak.visibility},
 analysisWindowMs:5,minimumSilenceMs:10,peakThreshold:0.000008};
const probes=r.events.filter(e=>['probe-seek','probe-sham'].includes(e.kind)&&e.wall>=r.start&&e.wall<r.end);
metrics.probes=probes.map(e=>{
 const bound=aligned(e);
 const previous=onsets.filter(t=>t<bound).at(-1),next=onsets.find(t=>t>=bound);
 const commands=events.filter(cmd=>cmd.kind==='correction'&&Math.abs(cmd.wall-e.wall)<=500);
 return {kind:e.kind,delta:e.delta,wall:e.wall,additionalCommands:commands.length-(e.kind==='probe-seek'?1:0),
   gap:active.some(g=>g.start<bound+250&&g.end>bound-250),
   beatIntervalMs:next!==undefined&&previous!==undefined?next-previous:null};
});
fs.writeFileSync(path.join(dir,'analysis.json'),JSON.stringify(metrics,null,2));
console.log(JSON.stringify({...metrics,covered:undefined,gaps:undefined,captureDiscontinuities:undefined,gapCount:observations.length,examples:observations.slice(0,3)}));
