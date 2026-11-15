// Mac-owned supervisor: no cloud subscription, and secrets stay in ignored local state.
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,chmodSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),state=join(root,'.local/shared-edm');
mkdirSync(state,{recursive:true,mode:0o700});chmodSync(state,0o700);
const configFile=join(state,'credentials.json'),docker='/usr/local/bin/docker',cloudflared=join(root,'.local/tools/cloudflared');
const port=18821,container='meta-club-edm-174',image='meta-club-shared-trial:review';
if(!existsSync(configFile)){
 const codes=Array.from({length:3},()=>randomBytes(18).toString('base64url'));
 writeFileSync(configFile,JSON.stringify({secret:randomBytes(48).toString('base64url'),codes,expires:new Date(Date.now()+14*86400000).toISOString()},null,2),{mode:0o600});
}
chmodSync(configFile,0o600);const config=JSON.parse(readFileSync(configFile,'utf8'));
if(Date.parse(config.expires)<=Date.now())throw Error('The two-week trial has expired; renew deliberately before starting again.');
const logFile=join(state,'service.log');let tunnel=null,server=null,stopping=false,restarting=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function log(text){writeFileSync(logFile,new Date().toISOString()+' '+text+'\n',{flag:'a',mode:0o600});}
function stopContainer(){
 const label=spawnSync(docker,['inspect','--format','{{index .Config.Labels "meta-club.trial"}}',container],{encoding:'utf8'});
 if(label.status===0&&label.stdout.trim()==='174')spawnSync(docker,['rm','-f',container],{stdio:'ignore',timeout:10000});
}
function guide(origin){
 const url=origin+'/clubs/edm',signIn=origin+'/auth/signin?callbackUrl=%2Fclubs%2Fedm';
 writeFileSync(join(state,'status.json'),JSON.stringify({url,signIn,expires:config.expires,pid:process.pid,port,updated:new Date().toISOString()},null,2),{mode:0o600});
 const rows=config.codes.map((code,i)=>`<section><h2>시험 회원 ${i+1}</h2><p>번호 <strong>${i+1}</strong> · 입장 코드 <code>${code}</code></p></section>`).join('');
 writeFileSync(join(state,'입장안내.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>EDM 3인 공동 시험 입장</title><style>body{font:17px/1.7 system-ui;max-width:820px;margin:40px auto;padding:20px;background:#171320;color:#f2edff}a{color:#b9f4e7}code{font-size:19px;user-select:all;background:#30243d;padding:6px}section{border-top:1px solid #665471;padding:12px 0}</style><h1>EDM 3인 공동 시험</h1><p><a href="${signIn}">공동 시험 입장하기</a></p><p>각자 다른 번호와 해당 코드를 사용하세요. 같은 번호는 동시에 쓸 수 없습니다. 로그인 후 세 사람 모두 같은 EDM 채널로 입장합니다.</p>${rows}<p>시험 만료: ${config.expires}. Mac·Docker·시험 서버·외부 통로가 실행 중이어야 합니다. 통로를 다시 만들면 주소가 바뀔 수 있습니다.</p><p>이 문서는 세 명의 입장 코드를 포함합니다. 공유할 상대에게는 각자 사용할 번호와 코드 한 개만 전달하세요.</p></html>`,{mode:0o600});
}
function startServer(origin){
 stopContainer();
 const values={...process.env,AUTH_URL:origin,AUTH_SECRET:config.secret,CLUB_SHARED_TRIAL:'1',CLUB_LOCAL_TEST:'0',CLUB_SHARED_TRIAL_CODE_HASHES:JSON.stringify(config.codes.map(code=>createHash('sha256').update(code).digest('hex'))),CLUB_SHARED_TRIAL_EXPIRES_AT:config.expires,CLUB_DB:'/data/club.sqlite',OPERATOR_ACCOUNT_IDS:'',PORT:'3000'};
 const names=['AUTH_URL','AUTH_SECRET','CLUB_SHARED_TRIAL','CLUB_LOCAL_TEST','CLUB_SHARED_TRIAL_CODE_HASHES','CLUB_SHARED_TRIAL_EXPIRES_AT','CLUB_DB','OPERATOR_ACCOUNT_IDS','PORT'];
 const args=['run','--rm','--name',container,'--label','meta-club.trial=174','--user','0','-p','127.0.0.1:'+port+':3000','-v',state+':/data',...names.flatMap(name=>['-e',name]),image];
 const child=server=spawn(docker,args,{env:values,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',data=>log(data.toString().trim()));child.stderr.on('data',data=>log(data.toString().trim()));
 child.on('error',error=>log('Server process error: '+error.message));
 child.once('exit',async code=>{if(!stopping&&!restarting&&tunnel?.exitCode===null){log('Restarting trial server after exit '+code);await delay(3000);if(!stopping&&!restarting)startServer(origin);}});
 log('Server starting at '+origin);
}
async function cycle(){
 while(!stopping&&Date.now()<Date.parse(config.expires)){
  restarting=false;let origin=null;
  tunnel=spawn(cloudflared,['tunnel','--no-autoupdate','--url','http://127.0.0.1:'+port,'--protocol','http2','--metrics','127.0.0.1:18822'],{stdio:['ignore','pipe','pipe']});
  const receive=data=>{
   const text=data.toString();log(text.trim());const found=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
   if(found&&!origin){origin=found[0];guide(origin);startServer(origin);}
  };
  tunnel.stdout.on('data',receive);tunnel.stderr.on('data',receive);tunnel.on('error',error=>log('Tunnel error: '+error.message));
  await new Promise(resolve=>{tunnel.once('exit',resolve);tunnel.once('error',resolve);});
  restarting=true;stopContainer();server?.kill('SIGTERM');if(!stopping){log('Recreating temporary tunnel');await delay(4000);}
 }
 stop();
}
function stop(){if(stopping)return;stopping=true;log('Stopping shared trial');tunnel?.kill('SIGTERM');stopContainer();server?.kill('SIGTERM');try{writeFileSync(join(state,'status.json'),JSON.stringify({stopped:true,at:new Date().toISOString()}),{mode:0o600});}catch{}setTimeout(()=>process.exit(0),300).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
process.on('uncaughtException',error=>{log('Supervisor error: '+error.message);stop();});
await cycle();
