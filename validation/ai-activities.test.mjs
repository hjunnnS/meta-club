import test from 'node:test';
import assert from 'node:assert/strict';
import {clubActivities} from '../app/club-activities.js';
const fixture=()=>clubActivities({actors:()=>[{id:'a',nickname:'A',seat:null,trainSlot:null,action:'groove'},{id:'b',nickname:'B'},{id:'ai',nickname:'AI 손님',ai:true}]});
test('AI greeting and gifts use existing effects',()=>{
 const a=fixture();assert(a.command('a','greeting-send',{to:'ai',kind:'wave',requestId:'g'}).ok);
 for(const kind of ['heart','bouquet','cake'])assert(a.command('a','gift-send',{to:'ai',kind,requestId:kind}).ok);
 const state=a.snapshot();assert.equal(state.greetings[0].to,'ai');assert.equal(state.socialEvents.length,3);
});
test('AI whispers remain sender-only with no fabricated reply',()=>{
 const a=fixture();const result=a.command('a','whisper-send',{to:'ai',text:'안녕하세요',requestId:'w',simulated:true});assert(result.ok);
 assert.equal(a.view('a').messages.length,1);assert.equal(a.view('b').messages.length,0);
 assert.equal(result.notification.to,'ai');assert.equal(result.notification.simulated,true);
 assert.equal(a.view('a').messages[0].from,'a');assert(!JSON.stringify(a.snapshot()).includes('안녕하세요'));
});
test('human whispers still remain private and use normal message type',()=>{
 const a=fixture();const r=a.command('a','whisper-send',{to:'b',text:'hello',requestId:'w',simulated:false});assert(r.ok);assert.equal(r.notification.simulated,false);
 assert.equal(a.view('b').messages.length,1);assert.equal(a.view('ai').messages.length,0);
});
