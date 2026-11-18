import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const codes=['trial-person-1-long-code','trial-person-2-long-code','trial-person-3-long-code'];
const env={...process.env,CLUB_SHARED_TRIAL:'1',CLUB_LOCAL_TEST:'0',AUTH_URL:'https://trial.example.com',CLUB_SHARED_TRIAL_CODE_HASHES:JSON.stringify(codes.map(code=>createHash('sha256').update(code).digest('hex'))),CLUB_SHARED_TRIAL_EXPIRES_AT:new Date(Date.now()+3600000).toISOString()};
function run(script,override={}){return spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../app',import.meta.url),env:{...env,...override},encoding:'utf8'});}
test('three invite slots have distinct identities; wrong code and expired trial denied',()=>{
 const r=run(`import assert from 'node:assert/strict';import {authorizeSharedTrial,sharedTrialMember} from './shared-trial.js';
 const codes=${JSON.stringify(codes)},ids=codes.map((accessCode,i)=>authorizeSharedTrial({tester:String(i+1),accessCode}).id);
 assert.equal(new Set(ids).size,3);assert(ids.every(id=>sharedTrialMember('local-test:'+id)));
 assert.equal(authorizeSharedTrial({tester:'1',accessCode:codes[1]}),null);
 assert.equal(authorizeSharedTrial({tester:'4',accessCode:codes[0]}),null);
 assert.equal(authorizeSharedTrial({tester:'1',accessCode:codes[0]},Date.now()+7200000),null);`);
 assert.equal(r.status,0,r.stderr);
});
test('missing invite config, duplicate hashes and HTTP origins fail closed',()=>{
 for(const override of [{CLUB_SHARED_TRIAL_CODE_HASHES:''},{CLUB_SHARED_TRIAL_CODE_HASHES:JSON.stringify(Array(3).fill('a'.repeat(64)))},{AUTH_URL:'http://trial.example.com'},{CLUB_LOCAL_TEST:'1'}])assert.notEqual(run(`await import('./shared-trial.js');`,override).status,0);
});
test('localhost test guard remains active; ordinary production still needs real providers',()=>{
 assert.notEqual(run(`await import('./local-test.js');`,{CLUB_SHARED_TRIAL:'0',CLUB_LOCAL_TEST:'1',NODE_ENV:'production',AUTH_URL:'https://localhost:18801'}).status,0);
 assert.notEqual(run(`await import('./local-test.js');`,{CLUB_SHARED_TRIAL:'0',CLUB_LOCAL_TEST:'1',NODE_ENV:'development'}).status,0);
 const r=run(`import {localTest} from './local-test.js';if(localTest)throw Error('Unexpected trial');`,{CLUB_SHARED_TRIAL:'0',CLUB_LOCAL_TEST:'0'});assert.equal(r.status,0,r.stderr);
});
test('ten failed invite attempts temporarily lock a slot without locking another tester',()=>{
 const r=run(`import assert from 'node:assert/strict';import {authorizeSharedTrial} from './shared-trial.js';const now=Date.now();
 for(let i=0;i<10;i++)assert.equal(authorizeSharedTrial({tester:'1',accessCode:'wrong-invite-code-123'},now),null);
 assert.equal(authorizeSharedTrial({tester:'1',accessCode:${JSON.stringify(codes[0])}},now),null);
 assert(authorizeSharedTrial({tester:'2',accessCode:${JSON.stringify(codes[1])}},now));
 assert(authorizeSharedTrial({tester:'1',accessCode:${JSON.stringify(codes[0])}},now+60001));`);assert.equal(r.status,0,r.stderr);
});
