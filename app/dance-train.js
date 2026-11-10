// A carriage follows the leader's actual footsteps at a fixed distance. Before
// the first step, the carriages form an arc on the approved central dance floor.
const radius = 6.6;
const places = 28;
const spacing = 1.4;
export function onTrainFloor(p) {
  return Math.hypot(p.x, p.z) <= 8.25 && Math.abs(p.y - 0.018) < 0.12;
}
export class DanceTrain {
  riders = new Map();
  leader = null;
  path = [];

  board(actor, command) {
    if (this.riders.has(actor.id) || actor.seat != null) return false;
    if (command === 'start' && !this.leader) {
      this.leader = actor.id;
      this.path = Array.from({ length: places + 1 }, (_, i) => {
        const angle = -i * spacing / radius;
        return { x: radius * Math.sin(angle), z: radius * Math.cos(angle), yaw: angle - Math.PI / 2 };
      });
    } else if (command !== 'join' || !this.leader) return false;
    const taken = new Set(this.riders.values());
    let slot = 0;
    while (taken.has(slot)) slot++;
    if (slot >= places) return false;
    this.riders.set(actor.id, slot);
    return true;
  }
  step(p) {
    const head = this.path[0];
    if (Math.hypot(p.x - head.x, p.z - head.z) < 0.05) return;
    this.path.unshift({ x: p.x, z: p.z, yaw: p.yaw });
    let length = 0;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      length += Math.hypot(a.x - b.x, a.z - b.z);
      if (length > places * spacing) {
        this.path.length = i + 1;
        break;
      }
    }
  }
  pose(id) {
    const slot = this.riders.get(id);
    let remaining = slot * spacing;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (remaining <= len || i === this.path.length - 1) {
        const f = Math.min(1, remaining / len);
        return { x: a.x + dx * f, z: a.z + dz * f, y: 0.018,
          yaw: slot === 0 ? a.yaw : Math.atan2(dx, dz), action: 'side-step', trainSlot: slot };
      }
      remaining -= len;
    }
  }
  leave(id) {
    if (!this.riders.has(id)) return [];
    const leaving = id === this.leader ? [...this.riders.keys()] : [id];
    for (const rider of leaving) this.riders.delete(rider);
    if (id === this.leader) {
      this.leader = null;
      this.path = [];
    }
    return leaving;
  }
}
