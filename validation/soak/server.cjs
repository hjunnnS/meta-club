const {Room, Server} = require('@colyseus/core');
const {WebSocketTransport} = require('@colyseus/ws-transport');
const guests = [3,16,29,42,55];
class DanceRoom extends Room {
  onCreate({capacity}) {
    if (![40,50,60].includes(capacity)) throw Error('invalid capacity');
    this.maxClients = capacity;
    this.members = new Set();
    this.last = new Map();
    this.pending = new Map();
    this.epoch = Date.now();
    this.tickMs = 0;
    this.onMessage('clock',(c, sent)=>c.send('clock',{sent,now:Date.now(),epoch:this.epoch}));
    this.onMessage('input',(c,input)=>{
      const record = [c.userData,input.seq,input.sent,input.variant];
      this.last.set(c.userData,record);
      this.pending.set(c.userData,record);
    });
    this.onMessage('restore',(c)=>c.send('restore',this.last.get(c.userData) || null));
    this.setSimulationInterval(()=>{
      const start = performance.now();
      const cue = Math.floor((Date.now()-this.epoch)/2000)%2;
      this.broadcast('beat',{members:this.members.size,ai:guests.map((id,i)=>[id,i<3?0:cue]),
        changes:[...this.pending.values()],tick:this.tickMs,epoch:this.epoch});
      this.pending.clear();
      this.tickMs = performance.now()-start;
    },50);
  }
  onJoin(c,{actor}) {
    if(!Number.isInteger(actor)||actor<0||actor>=this.maxClients||this.members.has(actor))throw Error('invalid member');
    c.userData=actor;this.members.add(actor);
  }
  onLeave(c){this.members.delete(c.userData);}
}
const server = new Server({transport:new WebSocketTransport()});
server.define('dance',DanceRoom);
server.listen(7351);
