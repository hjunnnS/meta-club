import assert from 'node:assert/strict';
import test from 'node:test';
import { ChannelZones } from '../../app/channel-zones.js';

const people=(n,hotspot=0,eventTier=0)=>({humans:n,humansByArea:hotspot?[hotspot]:[],eventTier});
function start(z,s){
  z.observe(s,0);
  assert.deepEqual(z.observe(s,9999),[]);
  const [first]=z.observe(s,10000);
  assert.equal(first.tier,1);assert.equal(z.canEnter(1),false);
  assert(z.finishOpening(1,first.attempt,true,10000));
}
test('approved tier boundaries and separate AI count',()=>{
  for(const [s,opened] of [[people(19,15),false],[people(20),true],[people(16,16),true],
     [{...people(15,15),ai:50},false]]){
    const z=new ChannelZones();z.observe(s,0);assert.equal(z.observe(s,10000).length>0,opened);
  }
  for(const [s,opened] of [[people(39,31),false],[people(40),true],[people(32,32),true]]){
    const z=new ChannelZones();start(z,s);assert.equal(z.observe(s,10000).length>0,opened);
  }
});
test('event holds only required tiers, staged preparation and reverse shrink',()=>{
  const z=new ChannelZones(),event=people(0,0,2);
  start(z,event);
  const [second]=z.observe(event,10000);assert.equal(second.tier,2);
  assert(z.finishOpening(2,second.attempt,true,10000));
  z.observe(event,190000);assert(z.canEnter(2));
  z.observe(people(30,25,1),190001); // local crowd still above shrink threshold
  z.observe(people(30,24,1),200000);z.observe(people(30,24,1),229999);
  assert(z.canEnter(2));z.observe(people(30,24,1),230000);
  assert.equal(z.state(2),'DRAINING');assert(z.canEnter(1));
  z.observe(people(0),260000);z.observe(people(0),300000);assert(z.canEnter(1));
});
test('tier one needs continuous low conditions and three minutes since ready',()=>{
  const z=new ChannelZones();start(z,people(20));
  z.observe(people(15,12),20000);z.observe(people(15,11),40000);
  z.observe(people(15,11),189999);assert(z.canEnter(1));
  z.observe(people(15,11),190000);assert.equal(z.state(1),'DRAINING');
});
