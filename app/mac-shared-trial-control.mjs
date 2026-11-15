import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const source=fileURLToPath(new URL('../',import.meta.url)),pointer=join(source,'.local/mac-trial-runtime.json');
const root=existsSync(pointer)?JSON.parse(readFileSync(pointer,'utf8')).root:source,state=join(root,'.local/shared-edm'),label='com.hjunnns.meta-club.edm174';
mkdirSync(state,{recursive:true,mode:0o700});
const command=process.argv[2]||'status';
if(command==='start'){
 const existing=spawnSync('/bin/launchctl',['list',label],{stdio:'ignore'});
 if(existing.status===0){console.log('Trial supervisor is already registered. Use status.');process.exit(0);}
 const result=spawnSync('/bin/launchctl',['submit','-l',label,'-o',join(state,'supervisor.log'),'-e',join(state,'supervisor.log'),'--','/usr/bin/caffeinate','-i',process.execPath,join(root,'app/mac-shared-trial.mjs')],{stdio:'inherit'});process.exit(result.status??1);
}else if(command==='stop'){
 const result=spawnSync('/bin/launchctl',['remove',label],{stdio:'inherit'});process.exit(result.status??1);
}else if(command==='status'){
 try{console.log(readFileSync(join(state,'status.json'),'utf8'));}catch{console.log('No trial status yet.');}
}else throw Error('Use start, stop or status');
