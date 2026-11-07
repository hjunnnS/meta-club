const { Room, Server } = require("@colyseus/core");
const { WebSocketTransport } = require("@colyseus/ws-transport");
class Probe extends Room {
  onCreate() {
    this.maxClients = 60;
    this.members = new Set();
    this.pending = [];
    this.last = new Map();
    this.onMessage("restore", (client) =>
      client.send("snapshot", {
        last: this.last.get(client.userData) ?? null,
        count: this.members.size,
      }),
    );
    this.previousMs = 0;
    this.onMessage("input", (client, m) => {
      this.last.set(client.userData, m);
      this.pending.push(m);
    });
    this.setSimulationInterval(() => {
      const start = Date.now();
      if (!this.pending.length) return;
      this.broadcast("state", {
        changes: this.pending.splice(0),
        count: this.members.size,
        previousMs: this.previousMs,
      });
      this.previousMs = Date.now() - start;
    }, 50);
  }
  onJoin(client, opts) {
    if (this.members.has(opts.key)) throw Error("occupied");
    client.userData = opts.key;
    this.members.add(opts.key);
  }
  onLeave(client) {
    if (client.userData) this.members.delete(client.userData);
  }
}
const server = new Server({ transport: new WebSocketTransport() });
server.define("g0", Probe);
server.listen(7351);
