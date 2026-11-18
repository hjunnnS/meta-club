import test from 'node:test';
import assert from 'node:assert/strict';
import {clubActivities} from '../app/club-activities.js';
function fixture(){
 let time=1000,people=[{id:'a',nickname:'A'},{id:'b',nickname:'B'}];
 let show={active:{kind:'laser',start:1000,seconds:16},next:{start:30000}};
 const activity=clubActivities({actors:()=>people,now:()=>time,performances:()=>show});
 return {activity,at:t=>time=t,show:s=>show=s,leave:id=>{people=people.filter(p=>p.id!==id);activity.leave(id);}};
}
test('one request waits through active/imminent shows, then starts once with full duration',()=>{
 const f=fixture(),a=f.activity;
 assert.equal(a.command('a','vip-start',{requestId:'one'}).queued,true);
 assert.equal(a.snapshot().parade,null);assert.equal(a.snapshot().activityStatus.paradeWaiting,true);
 assert.equal(a.view('a').cooldowns.paradeUntil,undefined);
 assert(a.command('b','vip-start',{requestId:'two'}).error);
 f.at(18000);f.show({active:null,next:{start:30000}});assert.equal(a.snapshot().parade,null);
 f.at(32000);f.show({active:null,next:{start:200000}});
 const running=a.snapshot();assert.equal(running.parade.from,'a');assert.equal(running.parade.seconds,45);assert.equal(running.parade.count,5);assert.equal(running.activityStatus.paradeWaiting,false);
 assert.equal(a.snapshot().parade.id,running.parade.id);assert.equal(a.view('a').cooldowns.paradeUntil,152000);
 f.at(77000);assert.equal(a.snapshot().parade,null);assert.equal(a.snapshot().activityStatus.paradeNextAt,137000);
});
test('stop and departure remove queued request without consuming reuse interval',()=>{
 for(const how of ['stop','leave']){
  const f=fixture(),a=f.activity;a.command('a','vip-start',{requestId:'one'});
  if(how==='stop')a.command('a','activities-stop');else f.leave('a');
  assert.equal(a.snapshot().activityStatus.paradeWaiting,false);
  f.at(32000);f.show({active:null,next:null});assert.equal(a.snapshot().parade,null);
  assert.equal(a.view('a').cooldowns.paradeUntil,undefined);
 }
});
