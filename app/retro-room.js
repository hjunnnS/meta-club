import { readFileSync } from 'node:fs';
import { ReviewRoom } from './review-room.js';

const bytes = readFileSync(new URL('../stage/retro/retro-empty.glb', import.meta.url));
const jsonEnd = 20 + bytes.readUInt32LE(12);
const { extras, meshes, accessors, bufferViews } = JSON.parse(bytes.toString('utf8', 20, jsonEnd));
const tiers = { entry: 0, hall: 0, stage: 0, A: 1, B: 2, lounge: 2, bar: 2 };
const floors = Object.entries(extras.zones).map(([name, bounds]) => ({
  name,
  bounds,
  tier: tiers[name],
}));
for (const [name, { bounds }] of Object.entries(extras.gateways)) {
  const [wing, link] = name.split(' ');
  floors.push({ name, bounds, tier: link === 'return' ? tiers[wing] : 0 });
}
// Each collision wall in the reviewed GLB is a box of twelve unindexed triangles.
const walls = [];
for (const mesh of meshes.filter((m) => m.name.startsWith('wall/'))) {
  const pos = accessors[mesh.primitives[0].attributes.POSITION];
  const start = jsonEnd + 8 + bufferViews[pos.bufferView].byteOffset;
  for (let i = 0; i < pos.count; i += 36) {
    const xs = [],
      zs = [];
    for (let j = i; j < i + 36; j++) {
      xs.push(bytes.readFloatLE(start + j * 12));
      zs.push(bytes.readFloatLE(start + j * 12 + 8));
    }
    walls.push([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  }
}
const contains = (x, z, [left, right, back, front]) =>
  x >= left && x <= right && z >= back && z <= front;
const [x, y, z] = extras.anchors['입구'];
const danceAreas = { mainDance: 'hall', danceA: 'A', danceB: 'B' };
export const retroRooms = new Map();
export class RetroRoom extends ReviewRoom {
  registry = retroRooms;
  entry = { x, y, z };
  area({ x, y, z }) {
    if (Math.abs(y) > 0.1 || walls.some((bounds) => contains(x, z, bounds))) return null;
    return floors.find((f) => contains(x, z, f.bounds));
  }
  registerActivities() {
    this.onMessage('activity', (c, key) => {
      const actor = this.members.get(c.sessionId);
      if (!actor) return;
      if (key === 'stop') {
        actor.action = 'idle';
        return;
      }
      if (typeof key !== 'string' || !Object.hasOwn(danceAreas, key)) return;
      const area = this.area(actor);
      const [cx, , cz] = extras.placements[key];
      if (
        area?.name !== danceAreas[key] ||
        !this.zones.canEnter(area.tier) ||
        Math.hypot(actor.x - cx, actor.z - cz) > 2.8
      )
        return c.send('notice', '열린 홀의 댄스 표시로 이동하세요.');
      actor.action = 'disco';
    });
  }
}
