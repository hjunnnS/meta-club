import { readFileSync } from 'node:fs';
import { memberChannelRoom } from './member-channel-room.js';
import { socialTables } from '../stage/social/tables.js';
import { blocked, muted } from './store.js';
import { blockedMessage } from './message-filter.js';

const bytes = readFileSync(new URL('../stage/social/social-empty.glb', import.meta.url));
const { extras } = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const seats = new Map(socialTables(extras).flatMap((t) => t.seats.map((s) => [s.id, s])));
const tiers = { entry: 0, main: 0, cafe: 0, garden: 1, booths: 1, vip: 2, roof: 2 };
const [x, y, z] = extras.anchors['입구'];
export const socialRooms = new Map();
export class SocialRoom extends memberChannelRoom('social') {
  registry = socialRooms;
  entry = { x, y, z };
  area({ x, y, z }) {
    for (const [
      name,
      {
        center: [cx, cy, cz],
        radius,
      },
    ] of Object.entries(extras.zones)) {
      if (Math.hypot(x - cx, z - cz) <= radius && Math.abs(y - cy) < 0.14)
        return { name, tier: tiers[name] };
    }
    for (const [name, [[ax, ay, az], [bx, by, bz]]] of Object.entries(extras.gateways)) {
      const dx = bx - ax,
        dz = bz - az,
        t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
      if (t < 0 || t > 1) continue;
      const width = name === 'entry-main' ? 3.2 : 2.5;
      if (
        Math.hypot(x - ax - t * dx, z - az - t * dz) <= width / 2 &&
        Math.abs(y - ay - t * (by - ay)) < 0.14
      )
        return { name, tier: Math.min(...name.split('-').map((k) => tiers[k])) };
    }
    return null;
  }
  registerActivities() {
    this.onMessage('sit', (c, id) => {
      const actor = this.members.get(c.sessionId),
        seat = seats.get(id);
      if (!actor || actor.seat || !seat) return;
      if (
        this.area(actor)?.name !== seat.table ||
        !this.zones.canEnter(tiers[seat.table]) ||
        Math.hypot(actor.x - seat.x, actor.z - seat.z) > 1.65
      )
        return c.send('notice', '열린 구역의 가까운 자리로 이동하세요.');
      if ([...this.members.values()].some((a) => a.seat === id))
        return c.send('notice', '다른 손님이 앉아 있습니다.');
      c.userData.standing = { x: actor.x, y: actor.y, z: actor.z, yaw: actor.yaw };
      Object.assign(actor, {
        seat: id,
        table: seat.table,
        x: seat.x,
        y: seat.y,
        z: seat.z,
        yaw: seat.yaw,
        action: 'sit',
      });
    });
    this.onMessage('stand', (c) => {
      const actor = this.members.get(c.sessionId);
      if (!actor?.seat) return;
      Object.assign(actor, c.userData.standing, { seat: null, table: null, action: 'idle' });
      c.send('place', actor);
    });
    this.onMessage('table-chat', (c, value) => {
      const actor = this.members.get(c.sessionId);
      if (!actor?.seat || typeof value !== 'string' || value.length > 320) return;
      const body = value.trim();
      if (
        !body ||
        /[\u0000-\u001f\u007f]/.test(body) ||
        blockedMessage(body) ||
        muted(c.userData.identity)
      )
        return c.send('notice', '이 메시지를 보낼 수 없습니다.');
      if (Date.now() - (c.userData.lastChat ?? 0) < 500) return;
      c.userData.lastChat = Date.now();
      for (const other of this.clients)
        if (
          this.members.get(other.sessionId)?.table === actor.table &&
          !blocked(other.userData.identity, c.userData.identity)
        )
          other.send('table-chat', { table: actor.table, nickname: actor.nickname, body });
    });
  }
}
