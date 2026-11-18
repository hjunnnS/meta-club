import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
const remote='https://github.com/hjunnnS/meta-club.git',branch='trial-endpoint',file='shared-trial-endpoint.json';
// Dedicated generated checkout: only public connection metadata is committed.
// Git uses the Mac's existing repository credentials; no token is copied here.
export function publishTrialEndpoint(status,directory){
 if(!directory||!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/clubs\/edm$/.test(status.url||''))return false;
 if(!Number.isFinite(Date.parse(status.expires))||Date.parse(status.expires)<=Date.now())return false;
 mkdirSync(directory,{recursive:true,mode:0o700});
 const git=args=>spawnSync('/usr/bin/git',args,{cwd:directory,encoding:'utf8',timeout:20000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
 const ok=args=>git(args).status===0;
 if(!existsSync(join(directory,'.git'))){
  if(!ok(['init','--initial-branch='+branch])||!ok(['remote','add','origin',remote]))return false;
 }
 if(git(['remote','get-url','origin']).stdout?.trim()!==remote)return false;
 if(!ok(['config','user.name','Meta Club Trial'])||!ok(['config','user.email','meta-club-trial@users.noreply.github.com']))return false;
 const refs=git(['ls-remote','--heads','origin','refs/heads/'+branch]);
 if(refs.status!==0)return false;
 if(refs.stdout.trim()&&(!ok(['fetch','--depth=1','origin','refs/heads/'+branch])||!ok(['checkout','-B',branch,'FETCH_HEAD'])))return false;
 const value={url:status.url,available:status.stopped!==true,expires:status.expires,updated:status.updated};
 try{const old=JSON.parse(readFileSync(join(directory,file),'utf8'));
  if(refs.stdout.trim()&&old.url===value.url&&old.expires===value.expires&&old.available===value.available)return true;
 }catch{}
 writeFileSync(join(directory,file),JSON.stringify(value,null,2)+'\n');
 return ok(['add','--',file])&&ok(['commit','-m','chore: refresh public EDM trial endpoint'])&&ok(['push','origin','HEAD:refs/heads/'+branch]);
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const source=process.argv[2],success=publishTrialEndpoint(JSON.parse(readFileSync(source,'utf8')),join(dirname(source),'endpoint-source'));
 console.log(success?'Public trial endpoint published.':'Endpoint publication deferred.');process.exitCode=success?0:1;
}
