import test from 'node:test';import assert from 'node:assert/strict';
import {tableMatch,seatedTable} from '../app/table-match.js';import {edmSeats} from '../app/edm-layout.js';
const base=edmSeats.findIndex(s=>s.table===1),other=edmSeats.findIndex(s=>s.table===2),upper=edmSeats.findIndex(s=>s.balcony&&s.area===0);
function fixture(){let time=1000;const people=[{id:'a',nickname:'A',seat:base},{id:'b',nickname:'B',seat:base+1},{id:'c',nickname:'C',seat:base+2},{id:'away',nickname:'Away',seat:other},{id:'ai',nickname:'AI',seat:base,ai:true}];const game=tableMatch({actors:()=>people,now:()=>time});return {game,people,at:t=>time=t,command:(id,action,extra={})=>game.command(id,{action,gameId:game.view(id).game?.id,...extra})};}
test('only actual seated tablemates may propose or join, including upper table grouping',()=>{
 const f=fixture();assert.equal(seatedTable(f.people[4]),null);assert.equal(seatedTable({seat:0}),null);
 assert.equal(seatedTable({seat:upper}).id,seatedTable({seat:upper+1}).id);assert.notEqual(seatedTable({seat:upper}).id,seatedTable({seat:upper+3}).id);
 assert(f.command('ai','propose').error);assert(f.command('away','propose').error);assert(f.command('a','propose').ok);
 assert(f.game.command('away',{action:'join',gameId:f.game.view('a').game.id}).error);assert.equal(f.game.view('away').game,null);
});
test('consent, private picks, participant-only results, mutual heart and skip',()=>{
 const f=fixture();f.command('a','propose');f.command('b','join');f.command('c','decline');
 assert.equal(f.game.view('a').game.phase,'choose');f.command('a','choose',{to:'b'});
 assert.equal(f.game.view('b').game.chosen,false);assert.equal(f.game.view('b').game.choice,null);assert.equal(f.game.view('b').game.edges,undefined);
 assert.equal(f.game.view('c').game.phase,'busy');assert(f.command('a','choose',{to:'away'}).error);
 f.command('b','choose',{to:'a'});const result=f.game.view('a').game;assert.equal(result.phase,'result');assert(result.edges.every(e=>e.mutual));assert.equal(f.game.view('c').game.edges,undefined);
 f.at(16001);assert.equal(f.game.view('a').game,null);
});
test('deadlines, skipped selection, leaving table, duplicate proposal and stale round rejection',()=>{
 const f=fixture();f.command('a','propose');assert(f.command('a','propose').error);f.command('b','join');f.at(21001);assert.equal(f.game.view('a').game.phase,'choose');
 f.command('a','choose',{to:null});f.at(41002);assert.deepEqual(f.game.view('b').game.edges,[]);
 f.people[1].seat=null;assert.equal(f.game.view('a').game,null);assert.equal(f.game.view('b').available,false);
 assert(f.game.command('a',{action:'choose',gameId:'stale',to:'b'}).error);
});
test('declining or leaving never traps users; fewer than two agreed users cancels',()=>{
 const f=fixture();f.command('a','propose');f.command('b','decline');f.command('c','decline');assert.equal(f.game.view('a').game,null);
 f.command('a','propose');f.command('b','join');f.command('c','join');f.command('a','choose',{to:'b'});f.people[1].seat=other;
 assert.equal(f.game.view('a').game.chosen,false);f.command('c','leave');assert.equal(f.game.view('a').game,null);
});
