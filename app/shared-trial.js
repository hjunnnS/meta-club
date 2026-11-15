import { createHash, timingSafeEqual } from 'node:crypto';

// Explicit, invite-only hosted trial; never relax the localhost-only test flag.
export const sharedTrial = process.env.CLUB_SHARED_TRIAL === '1';
let hashes=[],expires=0;
if(sharedTrial){
  const origin=new URL(process.env.AUTH_URL);
  if(origin.protocol!=='https:'||origin.href!==origin.origin+'/')throw Error('Shared trial requires an HTTPS origin');
  if(process.env.CLUB_LOCAL_TEST==='1')throw Error('Shared and localhost trial modes cannot be combined');
  try{hashes=JSON.parse(process.env.CLUB_SHARED_TRIAL_CODE_HASHES||'null');}catch{throw Error('Invalid shared trial code configuration');}
  if(!Array.isArray(hashes)||hashes.length!==3||hashes.some(hash=>typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))||new Set(hashes).size!==3)throw Error('Shared trial requires three distinct SHA-256 invite hashes');
  expires=Date.parse(process.env.CLUB_SHARED_TRIAL_EXPIRES_AT||'');
  if(!Number.isFinite(expires)||expires<=Date.now())throw Error('Shared trial requires a future expiry');
}
const failures=new Map();
export function sharedTrialExpiry(){return sharedTrial?expires:null;}
export function sharedTrialActive(now=Date.now()){return sharedTrial&&now<expires;}
export function sharedTrialMember(id){return typeof id==='string'&&/^local-test:shared-[123]$/.test(id);}
export function authorizeSharedTrial(input,now=Date.now()){
  if(!sharedTrialActive(now)||!input||!['1','2','3'].includes(input.tester)||typeof input.accessCode!=='string'||input.accessCode.length<16||input.accessCode.length>128)return null;
  const slot=Number(input.tester)-1,attempts=failures.get(slot)||{count:0,until:now+60000};
  if(now>=attempts.until){attempts.count=0;attempts.until=now+60000;}
  if(attempts.count>=10)return null;
  const actual=createHash('sha256').update(input.accessCode).digest(),expected=Buffer.from(hashes[slot],'hex');
  if(!timingSafeEqual(actual,expected)){attempts.count++;failures.set(slot,attempts);return null;}
  failures.delete(slot);
  return {id:'shared-'+input.tester,name:'시험 회원 '+input.tester};
}
