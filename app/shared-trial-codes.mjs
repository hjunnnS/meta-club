// Run privately after cost approval. Output is secret: never commit or paste into issues.
import {randomBytes,createHash} from 'node:crypto';
const codes=Array.from({length:3},()=>randomBytes(24).toString('base64url'));
console.log(JSON.stringify({AUTH_SECRET:randomBytes(48).toString('base64url'),CLUB_SHARED_TRIAL_CODE_HASHES:JSON.stringify(codes.map(code=>createHash('sha256').update(code).digest('hex'))),testers:codes.map((accessCode,index)=>({tester:index+1,accessCode}))},null,2));
