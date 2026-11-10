import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.CLUB_DB=join(mkdtempSync(join(tmpdir(),'edm-seating-')),'club.sqlite');
const {EdmRoom}=await import('../app/club-room.js');
const {edmSeats,edmArea,permittedPath}=await import('../app/edm-layout.js');

test('numbered booths synchronize seating, protect occupied seats and exit to the open aisle',()=>{
  const room=new EdmRoom(),handlers=new Map();
  room.roomId='edm-seating-check';
  room.onMessage=(type,handler)=>handlers.set(type,handler);
  room.setSimulationInterval=room.broadcast=()=>{};
  room.onCreate();
  const clients=['first','second'].map(sessionId=>({sessionId,send(){}}));
  const place=(client,point)=>{
    assert(room.positionMember(client.sessionId,null,point));
    Object.assign(room.member(client),point);
  };
  try{
    for(const c of clients)room.onJoin(c,{identity:'local-test:seating-'+c.sessionId});
    const [a,b]=clients,seat=handlers.get('seat');
    const booths=edmSeats.map((s,index)=>({...s,index})).filter(s=>s.table);
    assert.equal(booths.length,24);
    assert.deepEqual([...new Set(booths.map(s=>s.table))],[1,2,3,4,5,6,7,8]);
    assert.deepEqual(booths.filter(s=>s.x===20.05).map(s=>s.z),[16.6,12,7.4,2.8,-2,-6.8,-11.6,-16.2]);
    assert.equal(edmArea({x:14.6,y:0,z:6}).tier,1);
    assert(permittedPath({x:16.6,y:0,z:-1},{x:16.6,y:0,z:18.25},['CLOSED','CLOSED']));
    // Reject a forged long-distance target before moving any actor.
    seat(a,booths[0].index);assert.equal(room.member(a).seat,null);
    for(const target of booths){
      place(a,target.exit);seat(a,target.index);
      const actor=room.member(a);
      assert.equal(actor.seat,target.index);assert.equal(actor.table,target.table);
      assert.equal(actor.action,'sit');
      assert.equal(room.snapshot().actors.find(m=>m.id===a.sessionId).table,target.table);
      room.move(a,{...target.exit,yaw:0});assert.equal(actor.seat,target.index);
      place(b,target.exit);seat(b,target.index);assert.equal(room.member(b).seat,null);
      seat(a);assert.equal(actor.seat,null);assert.equal(actor.table,null);
      assert.equal(actor.action,'idle');assert.equal(actor.x,16.6);assert.equal(actor.y,0);
      a.userData.lastMove=Date.now()-1000;
      room.move(a,{x:16.2,y:0,z:target.exit.z,yaw:0});assert.equal(actor.x,16.2);
      seat(b,target.index);assert.equal(room.member(b).seat,target.index);
      seat(b);assert.equal(room.member(b).seat,null);
    }
    const target=booths[0];place(a,target.exit);seat(a,target.index);
    room.onLeave(a,true);place(b,target.exit);seat(b,target.index);
    assert.equal(room.member(b).seat,target.index);
    seat(b);place(b,{x:edmSeats[2].x,y:0,z:14.45,yaw:0});seat(b);
    assert.equal(room.member(b).seat,2); // existing bar stools still work
    seat(b);assert.equal(room.member(b).seat,null);
    seat(b,999);assert.equal(room.member(b).seat,null);
    seat(b,'5');assert.equal(room.member(b).seat,null);
  }finally{
    for(const c of clients)if(room.member(c))room.onLeave(c,true);
    room.clock.clear();room.onDispose();
  }
});
