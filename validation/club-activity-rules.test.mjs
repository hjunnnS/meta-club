import test from 'node:test';
import assert from 'node:assert/strict';
import {clubActivities,activityUsage,activityTrialRules} from '../app/club-activities.js';
import {execFileSync} from 'node:child_process';
const D=activityTrialRules.paradeSeconds*1000,C=activityTrialRules.paradeClearance;
let seq=0;const request=data=>({requestId:'test-'+ ++seq,...data});
function fixture({usage=activityUsage(),performances}={}){
 let time=1000,actors=Array.from({length:7},(_,i)=>({id:String(i),identity:'user-'+i,nickname:'손님'+i})),schedule={active:null,next:null};
 const activity=clubActivities({actors:()=>actors,identity:id=>actors.find(a=>a.id===id)?.identity,now:()=>time,usage,performances:performances||(()=>schedule),blockedMessage:s=>s.includes('금지')});
 return {a:activity,usage,at:t=>time=t,setActors:value=>actors=value,actors:()=>actors,shows:value=>schedule=value};
}
test('whisper accepts at exactly 2s, does not queue, rejected text does not consume and blocking remains immediate',()=>{
 const {a,at}=fixture();assert(a.command('0','whisper-send',request({to:'1',text:'첫 메시지'})).ok);
 at(2999);const rejected=request({to:'1',text:'빠른 메시지'});assert.equal(a.command('0','whisper-send',rejected).retryAfterMs,1);assert.equal(a.view('1').messages.length,1);
 assert(a.command('0','whisper-block',{to:'1'}).ok);assert(a.command('0','whisper-unblock',{to:'1'}).ok);
 at(3000);assert(a.command('0','whisper-send',rejected).ok);at(5000);assert(a.command('0','whisper-send',request({to:'1',text:'금지'})).error);assert(a.command('0','whisper-send',request({to:'1',text:'수정'})).ok);
 assert.equal(a.view('2').messages.length,0);assert(!JSON.stringify(a.snapshot()).includes('첫 메시지'));
});
test('same-user limits survive a changed session, room instance and browser adapter recreation',()=>{
 const storage=new Map(),adapter={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const f=fixture({usage:activityUsage({storage:adapter})}),a=f.a;
 assert(a.command('0','shout-send',request({text:'외치기'})).ok);a.leave('0');f.setActors(f.actors().map(x=>x.id==='0'?{...x,id:'new-session'}:x));
 assert(a.command('new-session','shout-send',request({text:'아직'})).error);
 const second=fixture({usage:activityUsage({storage:adapter})});second.at(30999);assert.equal(second.a.command('0','shout-send',request({text:'아직'})).retryAfterMs,1);second.at(31000);assert(second.a.command('0','shout-send',request({text:'가능'})).ok);
 const third=fixture({usage:activityUsage({storage:adapter})});third.at(31001);assert(third.a.command('0','shout-send',request({text:'새 방'})).error);
 assert(![...storage.values()].some(v=>v.includes('외치기')||v.includes('새 방')));
});
test('shout is 5s, cooldown 30s, FIFO queue maximum 3 and rejected full-queue request remains reusable',()=>{
 const f=fixture(),{a}=f;const send=(id,text)=>a.command(id,'shout-send',request({text}));
 assert(send('0','표시').ok);assert(send('1','대기1').ok);assert(send('2','대기2').ok);assert(send('3','대기3').ok);assert.equal(a.snapshot().activityStatus.shoutWaiting,3);
 const refused=request({text:'대기4'});assert(a.command('4','shout-send',refused).error);assert(!a.view('4').cooldowns.shoutUntil);
 f.at(6000);assert.equal(a.snapshot().shout.text,'대기1');assert(a.command('4','shout-send',refused).ok);
 f.at(11000);assert.equal(a.snapshot().shout.text,'대기2');f.at(16000);assert.equal(a.snapshot().shout.text,'대기3');f.at(21000);assert.equal(a.snapshot().shout.text,'대기4');f.at(26000);assert.equal(a.snapshot().shout,null);
 f.at(30999);assert.equal(send('0','다시').retryAfterMs,1);f.at(31000);assert(send('0','다시').ok);
});
test('main show priority holds shouts without changing its clock; queued shouts resume after parade',()=>{
 const f=fixture(),{a}=f;f.shows({active:{kind:'laser',start:1000,seconds:16},next:{start:90000}});
 assert(a.command('0','shout-send',request({text:'공연 후'})).queued);assert.equal(a.snapshot().shout,null);assert(a.command('1','whisper-send',request({to:'2',text:'대화 가능'})).ok);
 assert(a.command('1','vip-start',request()).error);assert(!a.view('1').cooldowns.paradeUntil);
 f.at(17000);assert.equal(a.snapshot().shout.text,'공연 후');assert(a.command('1','vip-start',request()).error);
 f.at(22000);assert(a.command('1','vip-start',request()).ok);assert(a.command('2','shout-send',request({text:'퍼레이드 후'})).queued);assert.equal(a.snapshot().shout,null);
 f.at(22000+D);assert.equal(a.snapshot().parade,null);assert.equal(a.snapshot().shout.text,'퍼레이드 후');
});
test('no shout begins without 5s clearance and preview interruption preserves the unused display duration',()=>{
 const f=fixture(),{a}=f;f.shows({active:null,next:{start:3000}});a.command('0','shout-send',request({text:'대기'}));assert.equal(a.snapshot().shout,null);
 f.at(3000);f.shows({active:{kind:'whale',start:3000,seconds:14},next:{start:90000}});assert.equal(a.snapshot().shout,null);
 f.at(17000);assert.equal(a.snapshot().shout.start,17000);
 f.at(18000);f.shows({active:{kind:'laser',start:18000,seconds:16},next:{start:90000}});assert.equal(a.snapshot().shout,null);
 f.at(34000);const resumed=a.snapshot().shout;assert.equal(resumed.seconds,4);assert.equal(resumed.start,34000);f.at(38000);assert.equal(a.snapshot().shout,null);
});
test('parade full-lap clearance and lifetime, personal 120s and club 60s from natural end',()=>{
 const f=fixture(),{a}=f;f.shows({active:null,next:{start:1000+C-1}});assert(a.command('0','vip-start',request()).error);assert(!a.view('0').cooldowns.paradeUntil);
 f.shows({active:null,next:{start:1000+C}});assert(a.command('0','vip-start',request()).ok);assert.equal(a.snapshot().parade.count,5);assert.equal(a.snapshot().parade.seconds,activityTrialRules.paradeSeconds);
 assert(a.command('1','vip-start',request()).error);f.at(1000+D);assert.equal(a.snapshot().parade,null);
 f.shows({active:null,next:null});f.at(1000+D+60000-1);assert.equal(a.command('1','vip-start',request()).retryAfterMs,1);f.at(1000+D+60000);assert(a.command('1','vip-start',request()).ok);
 assert(a.command('0','vip-start',request()).error);f.at(121000);assert(!a.view('0').cooldowns.paradeUntil||a.view('0').cooldowns.paradeUntil<=121000);assert(a.command('0','vip-start',request()).error);
 f.at(121000+2*D);assert(a.command('0','vip-start',request()).ok);
});
test('early stop/leave starts club cooldown at actual end; cross-room lease cannot be overwritten by an old room',()=>{
 const shared=activityUsage(),f=fixture({usage:shared});assert(f.a.command('0','vip-start',request()).ok);f.at(3000);f.a.command('0','activities-stop');assert.equal(f.a.snapshot().activityStatus.paradeNextAt,63000);
 const other=fixture({usage:shared});other.at(62999);assert(other.a.command('1','vip-start',request()).error);other.at(63000);assert(other.a.command('1','vip-start',request()).ok);
 f.at(63001);assert(f.a.command('2','vip-start',request()).error);
 other.at(65000);other.a.leave('1');assert.equal(other.a.snapshot().activityStatus.paradeNextAt,125000);
 const stale=fixture({usage:shared});stale.at(125000);assert(stale.a.command('2','vip-start',request()).ok);
 other.at(125001);other.a.snapshot();assert.equal(shared.gate().activeUntil,125000+D);
});
test('two live browser usage adapters observe the same cooldown deadlines without storing messages',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},a=fixture({usage:activityUsage({storage})}),b=fixture({usage:activityUsage({storage})});
 assert(a.a.command('0','whisper-send',request({to:'1',text:'비공개 본문'})).ok);assert(b.a.command('0','whisper-send',request({to:'1',text:'겹친 탭'})).error);
 assert(!JSON.stringify([...values]).includes('비공개 본문'));assert(!JSON.stringify([...values]).includes('겹친 탭'));
});
test('side-screen overlay anchors and house shows/music/map are protected',()=>{
 const files=['stage/festival/events.js','stage/festival/celebration.js','stage/festival/holograms.js','stage/festival/edm-festival.glb','app/public/ambience.js','app/public/ceiling-lights.js','app/public/rhythm-floor.js','app/public/free-dance.js','app/public/music.js','app/club-performances.js','app/edm-layout.js'];
 execFileSync('git',['diff','--exit-code','8ac0366','--',...files],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
});
