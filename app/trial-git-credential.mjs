// Git invokes this helper only in the generated public-endpoint checkout.
// Reuse the already registered owner credential without changing gh's active
// account. Its output is consumed by Git, never written to a file or log.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if(process.argv[2]!=='get')process.exit(0);
const fields=Object.fromEntries(readFileSync(0,'utf8').split('\n').filter(Boolean).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
if(fields.protocol!=='https'||fields.host!=='github.com'||!['hjunnnS/meta-club','hjunnnS/meta-club.git'].includes(fields.path))process.exit(0);
const result=spawnSync('/opt/homebrew/bin/gh',['auth','token','--hostname','github.com','--user','hjunnnS'],{encoding:'utf8',timeout:10000});
if(result.status!==0||!result.stdout.trim())process.exit(1);
process.stdout.write('username=hjunnnS\npassword='+result.stdout.trim()+'\n\n');
