import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [dir,destination]=process.argv.slice(2);
const a=JSON.parse(fs.readFileSync(path.join(dir,'analysis.json')));
const anchors=fs.readFileSync(path.join(dir,'anchors.txt'),'utf8').trim().split('\n').map(l=>l.split(/\s+/).map(Number));
const output=path.join(dir,'output.f32');
fs.mkdirSync(destination,{recursive:true});
function clip(name,wall){
 const anchor=anchors.filter(x=>x[1]<=wall).at(-1);
 const middle=anchor[0]/48000+(wall-anchor[1])/1000;
 execFileSync('ffmpeg',['-loglevel','error','-y','-f','f32le','-ar','48000','-ac','1','-ss',String(middle-1.5),'-i',output,'-t','3','-c:a','pcm_s24le',path.join(destination,name+'.wav')]);
}
const loop=a.gaps.filter(g=>g.nearby.length===1&&g.nearby[0]==='wrap').sort((a,b)=>a.ms-b.ms);
if(loop.length){
 const sample=loop[Math.floor(loop.length/2)];
 clip('loop',sample.wall);clip('regular',sample.wall-4);
 console.log('loop sample',sample.atSec,sample.ms);
}
