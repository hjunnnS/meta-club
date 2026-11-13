import {socialTrial} from './social-trial.js';
import {birthdayRequests} from './birthday-requests.js';
import {validWandStyle,normalizeWandStyle} from './public/wand-customization.js';
import {requestPodium,validPodiumArrival,beginPodium,clearPodium} from './podium-activity.js';
import { DanceTrain, onTrainFloor } from './dance-train.js';
import { effects } from '../stage/festival/events.js';
import { localTest } from './local-test.js';
import { ManagedChannelZones } from './managed-channel-zones.js';
import { edmArea, permittedPath, edmSeats as seats, nearbyEdmSeats, nearbyEdmPole } from './edm-layout.js';
import { blockedMessage } from './message-filter.js';
import { background, extraGuestPlaces } from './visitors.js';
import { performanceStatus } from './club-performances.js';
import { playlistPosition,trackBeat } from './public/music.js';
import { playlist } from './music.js';
import { Room } from '@colyseus/core';
import { profile } from './store.js';

export const capacity = 60;
export const seatSeconds = 15;
export const connected = new Map(),
  pending = new Map(),
  recent = new Map(),
  rooms = new Map();
// Additional background visitors use only spare human places, never reserved seats.
const extraVisitors = Number(process.env.CLUB_AI_EXTRA_WHEN_EMPTY || 15);
if (!Number.isInteger(extraVisitors) || extraVisitors < 0 || extraVisitors > capacity)
  throw Error('CLUB_AI_EXTRA_WHEN_EMPTY must be an integer from 0 to ' + capacity);
const floorEntry = { x: -1.8, y: 0.018, z: 6.4, yaw: -1.0 };
import { dances } from './public/free-dance.js';
const emotions = new Set(['idle', 'dance', 'wave', 'pole-dance', ...dances.keys()]);
function text(value, max) {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)
    ? value.trim()
    : '';
}
export class EdmRoom extends Room {
  onAuth(_client, options, context) {
    return EdmRoom.verifyIdentity(context.headers, options.identity);
  }
  onCreate() {
    this.maxClients = capacity;
    this.setSeatReservationTime(seatSeconds);
    this.members = new Map();
    this.poleAnchors = new WeakMap();
    this.podiumClaims=new Map();
    this.train = new DanceTrain();
    this.zones = new ManagedChannelZones();
    this.preparing = [];
    this.eventTier = 0;
    this.epoch = Date.now();
    rooms.set(this.roomId, this);
    this.ai = Array.from({ length: 5 }, (_, i) => ({
      id: 'ai-' + i,
      ai: true,
      nickname: 'AI 손님 ' + (i + 1),
      avatar: 'gold',
      x: 4 * Math.cos(i * 1.25),
      y: 0.018,
      z: 4 * Math.sin(i * 1.25),
      yaw: i * 1.25,
      action: 'dance',
    }));
    this.refreshVisitors();
    this.dirty = false;
    if (localTest) {
      this.eventSequence = 0;
      this.social=socialTrial(()=>[...this.members.values()]);
      this.birthdays=birthdayRequests(()=>[...this.members.values()],(request,sender,target)=>{
        if(blockedMessage(target.nickname)||blockedMessage(sender.nickname)||/[\p{Cc}\p{Cf}]/u.test(target.nickname+sender.nickname))return '닉네임 문구를 확인해 주세요.';
        if(this.stageEvent&&Date.now()<this.stageEvent.start+effects[this.stageEvent.kind].seconds*1000)return '다른 연출이 진행 중입니다. 종료 후 다시 제안해 주세요.';
        this.stageEvent={id:request.id,kind:'led',start:Date.now(),bpm:playlistPosition(playlist(),this.epoch,Date.now())?.track.bpm||132,
          message:target.nickname+'님 생일 축하합니다!',nickname:sender.nickname,socialBirthday:true,birthdayFrom:sender.id,birthdayTo:target.id};
        this.social.add('birthday',sender.id,target.id);this.dirty=true;return null;
      });
      this.onMessage('social-stop',client=>{
        if(!this.member(client)||!client.userData.identity.startsWith('local-test:'))return;
        this.social.stop(client.sessionId);
        if(this.stageEvent?.socialBirthday&&[this.stageEvent.birthdayFrom,this.stageEvent.birthdayTo].includes(client.sessionId))this.stageEvent=null;
        this.dirty=true;
      });
      const birthdayState=()=>{for(const c of this.clients)if(c.userData?.identity?.startsWith('local-test:'))c.send('birthday-state',this.birthdays.state(c.sessionId));};
      this.birthdayState=birthdayState;
      for(const kind of ['birthday-state','birthday-propose','birthday-reply','birthday-cancel'])this.onMessage(kind,(client,input)=>{
        if(!this.member(client)||!client.userData.identity.startsWith('local-test:'))return;
        let result;
        if(kind==='birthday-propose'){
          if(!this.clients.some(c=>c.sessionId===input?.targetId&&c.userData?.identity?.startsWith('local-test:')))return this.notice(client,'같은 클럽의 시험 회원을 선택해 주세요.');
          result=this.birthdays.propose(client.sessionId,input.targetId);
        }else if(kind==='birthday-reply')result=this.birthdays.answer(client.sessionId,input?.id,input?.accept);
        else if(kind==='birthday-cancel')result=this.birthdays.cancel(client.sessionId,input?.id);
        if(result?.error)this.notice(client,result.error);
        birthdayState();
      });
      this.onMessage('wand-style',(client,input)=>{
        const actor=this.member(client);
        if(!actor||!client.userData.identity.startsWith('local-test:')||!validWandStyle(input))return;
        actor.wandStyle=normalizeWandStyle(input);this.dirty=true;
      });
      this.onMessage('preview-event', (client, input) => {
        const actor = this.member(client);
        if (!actor || !client.userData.identity.startsWith('local-test:')) return;
        if (input?.kind === 'stop') {
          this.stageEvent = null;
        } else {
          if (typeof input?.kind !== 'string' || !Object.hasOwn(effects, input.kind)) return;
          const event = { id: ++this.eventSequence, kind: input.kind, start: Date.now(), bpm:playlistPosition(playlist(),this.epoch,Date.now())?.track.bpm || 120 };
          if (event.kind === 'led') {
            const message = text(input.message, 80);
            if (!message || /[\p{Cc}\p{Cf}]/u.test(message + actor.nickname) ||
                blockedMessage(message) || blockedMessage(actor.nickname))
              return this.notice(client, '닉네임과 전광판 문구를 확인해 주세요.');
            Object.assign(event, { message, nickname: actor.nickname });
          }
          this.stageEvent = event;
        }
        this.dirty = true;
      });
    }
    this.onMessage('train', (client, command) => {
      const actor = this.member(client);
      if (!actor || !this.allowActivity(client)) return;
      if (command === 'leave') return this.leaveTrain(actor.id);
      if (!['start', 'join'].includes(command)) return;
      if (!this.train.board(actor, command))
        return this.notice(client, '기차 상태를 확인하세요. 착석 중에는 먼저 일어서 주세요.');
      const next = this.train.pose(actor.id);
      if (!this.positionMember(actor.id, actor, next)) {
        this.train.leave(actor.id);
        return this.notice(client, '열린 동선에서만 기차에 참여할 수 있습니다.');
      }
      Object.assign(actor, next);
      if (command === 'start') {
        const distance = a => Math.hypot(a.x - next.x, a.z - next.z);
        const nearby = this.ai.filter(a => a.action !== 'sit').sort((a, b) => distance(a) - distance(b));
        for (const guest of nearby.slice(0, 2)) this.train.board(guest, 'join');
        this.refreshVisitors();
      }
      client.send('place', actor);
      this.notice(client, command === 'start' ? '중앙 플로어에서 WASD로 기차를 이끄세요.' : '댄스 기차에 합류했습니다.');
      this.dirty = true;
    });
    this.onMessage('wand', (client, enabled) => {
      const actor = this.member(client);
      if (actor && typeof enabled === 'boolean' && this.allowActivity(client)) {
        if(enabled&&!actor.wand)this.react(actor,'disco-point',true);
        actor.wand = enabled;
        this.dirty = true;
      }
    });
    this.onMessage('occupancy', (c) => c.send('occupancy', this.population()));
    this.onMessage('snapshot', (c) => c.send('snapshot', this.snapshot()));
    this.onMessage('clock', (c, sent) => {
      if (Number.isFinite(sent))
        c.send('clock', { sent, now: Date.now(), epoch: this.epoch, tracks: playlist() });
    });
    this.onMessage('move', (c, p) => this.move(c, p));
    this.onMessage('podium-request',(c,data)=>{
      const m=this.member(c);if(!m||!this.allowActivity(c))return;
      const place=requestPodium(this.podiumClaims,[...this.members.values(),...this.ai],m,data?.podium,Date.now());
      if(!place)return this.notice(c,'단상에 빈 자리가 없습니다. 다른 단상을 선택해 주세요.');
      clearPodium(m);m.action='idle';this.poleAnchors.delete(m);this.dirty=true;c.send('podium-place',place);
    });
    this.onMessage('podium-cancel',c=>this.podiumClaims.delete(c.sessionId));
    this.onMessage('podium-start',(c,data)=>{
      const m=this.member(c),now=Date.now();
      if(!m||!this.allowActivity(c)||!validPodiumArrival(this.podiumClaims,m,data,now)||!this.positionMember(m.id,m,data))return;
      const position=playlistPosition(playlist(),this.epoch,now);
      const beat=trackBeat(position,0)+(position?.cycle||0)*(position?.track.duration||0)*(position?.track.bpm||132)/60;
      beginPodium(this.podiumClaims,m,data,beat);this.poleAnchors.set(m,{x:m.x,y:m.y,z:m.z});
      c.userData.lastMove=now;this.dirty=true;
    });
    this.onMessage('pole-grip',(c,p)=>{
      const m=this.member(c);
      if(!m||!this.allowActivity(c)||m.seat!==null||this.train.riders.has(m.id)||!p||
        !['x','y','z','yaw'].every(k=>Number.isFinite(p[k]))||!nearbyEdmPole({...m,...p},.95))return;
      const elapsed=Math.max(0,(Date.now()-c.userData.lastMove)/1000);
      if(Math.hypot(p.x-m.x,p.y-m.y,p.z-m.z)>Math.min(.5,elapsed*4.5+.16)||!this.positionMember(m.id,m,p))return;
      Object.assign(m,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,action:'pole-dance'});
      this.poleAnchors.set(m,{x:p.x,y:p.y,z:p.z});
      c.userData.lastMove=Date.now();this.dirty=true;
    });
    this.onMessage('action', (c, a) => {
      const m = this.member(c);
      if (!m || !this.allowActivity(c) || !emotions.has(a) || m.seat !== null || this.train.riders.has(m.id)) return;
      if(a==='pole-dance'&&!nearbyEdmPole(m,.95))return this.notice(c,'단상 위 봉 가까이에서 시작해 주세요.');
      clearPodium(m);this.podiumClaims.delete(m.id);
      m.action = a;
      if(a==='pole-dance')this.poleAnchors.set(m,{x:m.x,y:m.y,z:m.z});
      else this.poleAnchors.delete(m);
      this.dirty = true;
      if (a === 'wave' || a === 'dance') this.react(m, a, true);
    });
    const seatActivity = (c, requested, standOnly=false) => {
      const m = this.member(c);
      if (!m || !this.allowActivity(c) || this.train.riders.has(m.id)) return;
      if(standOnly&&m.seat==null){c.send('place',m);return;}
      if (m.seat !== null) {
        const exit = seats[m.seat]?.exit || c.userData.preSeat;
        if (!exit || !this.positionMember(c.sessionId, m, exit)) return;
        Object.assign(m, exit);
        m.seat = null;
        m.table = null;
        m.action = 'idle';delete m.seatMotion;delete c.userData.preSeat;
      } else {
        if (requested !== undefined && !Number.isInteger(requested)) return;
        const occupied = new Set([...this.members.values()].map(other=>other.seat));
        const candidate = nearbyEdmSeats(m).find(({index})=>
          (requested === undefined || index === requested) && !occupied.has(index));
        if (!candidate) return this.notice(c, '가까운 빈 소파 의자 앞에서 앉기를 눌러 주세요.');
        const idx = candidate.index;
        if (!this.positionMember(c.sessionId, m, seats[idx])) return;
        c.userData.preSeat = { x: m.x, y: m.y, z: m.z, yaw: m.yaw };
        const {exit,label,balcony,area,...pose} = seats[idx];
        if(seats[idx].table||seats[idx].balcony)m.seatMotion={from:{...c.userData.preSeat},at:Date.now(),seat:idx};
        clearPodium(m);this.poleAnchors.delete(m);this.podiumClaims.delete(m.id);
        Object.assign(m, pose, { seat: idx, table: pose.table ?? null, action: 'sit' });
      }
      this.dirty = true;
      c.send('place', m);
    };
    this.onMessage('seat', (c, requested)=>seatActivity(c,requested));
    this.onMessage('stand', c=>seatActivity(c,undefined,true));
    this.setSimulationInterval(() => {
      if (this.dirty) {
        this.broadcast('snapshot', this.snapshot());
        this.dirty = false;
      }
    }, 100);
    this.clock.setInterval(() => {
      this.tickZones(performance.now());
      this.refreshVisitors();
      for (const ai of this.ai.slice(3, 5)) if (Date.now() > (ai.until || 0)) ai.action = 'dance';
      this.dirty = true;
    }, 300);
  }
  leaveTrain(id) {
    for (const rider of this.train.leave(id)) {
      const actor = this.members.get(rider);
      if (!actor) continue; // AI resumes its usual pose on the next snapshot.
      actor.trainSlot = null;
      actor.action = 'idle';
      const client = this.clients.find(c => c.sessionId === rider);
      if (client) {
        client.userData.lastMove = Date.now();
        client.send('place', actor);
      }
    }
    this.dirty = true;
  }
  zoneStates() {
    return [this.zones.state(1), this.zones.state(2)];
  }

  tickZones(now) {
    // All geometry is prebuilt. Publish OPENING for a tick before allowing entry.
    for (const { tier, attempt } of this.preparing)
      this.zones.finishOpening(tier, attempt, true, now);
    this.preparing = this.zones.observe(now, this.eventTier);
    for (const tier of [2, 1]) {
      if (this.zones.state(tier) !== 'DRAINING') continue;
      for (const id of this.zones.drain(tier, now).movedAI) {
        const actor = this.ai.find((a) => a.id === id);
        if (actor)
          Object.assign(actor, { x: actor.x < 0 ? -4 : 4, y: 0.018, z: 1, action: 'dance' });
      }
    }
  }

  positionMember(id, from, to) {
    if (from && !permittedPath(from, to, this.zoneStates())) return false;
    const { tier, group } = edmArea(to);
    return this.zones.move('human', id, this.zones.location('human', id), tier, group);
  }

  refreshVisitors() {
    const before = new Set(this.ai.map((a) => a.id));
    const elapsed = (Date.now() - this.epoch) / 1000;
    for (let i = 0; i < 3; i++) {
      if (!this.train.riders.has(this.ai[i].id)) this.ai[i] = background(i, elapsed);
    }
    const extra = Math.min(extraGuestPlaces.length, extraVisitors, capacity - this.members.size);
    this.ai.length = 5 + extra;
    for (let i = 0; i < extra; i++) {
      if (this.ai[5 + i]) continue;
      this.ai[5 + i] = {
        id: 'floor-dancer-' + i, ai: true, nickname: 'AI 손님 ' + (6 + i),
        avatar: ['teal', 'rose', 'gold', 'indigo'][i % 4],
        ...extraGuestPlaces[i],
      };
    }
    // Two reactive dancers use the reviewed side floors once available.
    for (const [i, actor] of this.ai.entries()) {
      if (i === 3 || i === 4) {
        const sign = i === 3 ? -1 : 1;
        const side = this.zones.canEnter(1);
        Object.assign(actor, {
          x: sign * (side ? 14.6 : 4),
          y: side ? 0.045 : 0.018,
          z: side ? 6 : 1,
        });
      }
      actor.wand = i === 3 || i === 4;
      before.delete(actor.id);
      const { tier, group } = edmArea(this.train.riders.has(actor.id) ? this.train.pose(actor.id) : actor);
      if (!this.zones.move('ai', actor.id, this.zones.location('ai', actor.id), tier, group)) {
        Object.assign(actor, { x: 0, y: 0.018, z: 0, action: 'dance' });
        this.zones.move('ai', actor.id, this.zones.location('ai', actor.id), 0, 'dancefloor');
      }
    }
    for (const id of before) {
      this.train.leave(id);
      this.zones.move('ai', id, this.zones.location('ai', id), null);
    }
  }
  react(member, action, explicit = false) {
    for (const ai of this.ai.slice(3, 5)) {
      if (
        Math.hypot(ai.x - member.x, ai.z - member.z) < 4 &&
        (explicit || Date.now() > (ai.until || 0))
      ) {
        ai.action = action;
        ai.yaw = Math.atan2(ai.x - member.x, ai.z - member.z);
        ai.until = Date.now() + 2400;
      }
    }
  }
  notice(c, msg) {
    c.send('notice', msg);
  }
  member(c) {
    return this.members.get(c.sessionId);
  }
  allowActivity(c) {
    if (!c.userData.identity.startsWith('guest:')) return true;
    this.notice(c, '이 활동은 로그인 후 사용할 수 있습니다.');
    return false;
  }
  population() {
    return { channelId: this.roomId, people: this.members.size, ai: this.ai.length, capacity };
  }
  snapshot() {
    const event = this.stageEvent;
    if (event && Date.now() >= event.start + effects[event.kind].seconds * 1000) this.stageEvent = null;
    const performances = performanceStatus(this.epoch, Date.now(), playlist());
    return {
      socialEvents:this.social?.snapshot()||[],
      stageEvent: this.stageEvent ?? performances.active,
      nextPerformance: performances.next,
      performanceNow: Date.now(),
      trainLeader: this.train.leader,
      actors: [...this.members.values(), ...this.ai.map(a =>
        this.train.riders.has(a.id) ? { ...a, ...this.train.pose(a.id) } : a)],
      epoch: this.epoch,
      zones: this.zoneStates(),
    };
  }
  move(c, p) {
    const m = this.member(c);
    if (!m || m.seat !== null || m.trainSlot > 0 || !p || !['x', 'y', 'z', 'yaw'].every((k) => Number.isFinite(p[k])))
      return;
    const elapsed = (Date.now() - c.userData.lastMove) / 1000;
    if (elapsed < 0.045) return;
    if (
      Math.abs(p.x) > 22.6 ||
      p.z < -21.5 ||
      p.z > 27 ||
      p.y < -0.08 ||
      p.y > 4.1 ||
      Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z) > Math.min(5, elapsed * 4.5 + 0.16)
    ) {
      c.send('place', m);
      return;
    }
    if ((m.trainSlot === 0 && !onTrainFloor(p)) || !this.positionMember(c.sessionId, m, p)) {
      c.send('place', m);
      return;
    }
    const anchor=['pole-dance','podium-dance'].includes(m.action)?this.poleAnchors.get(m):null;
    if(anchor&&Math.hypot(p.x-anchor.x,p.z-anchor.z)<.08&&Math.abs(p.y-anchor.y)<.08){
      // Heartbeats and small standing corrections must not become walking.
      m.yaw=p.yaw;c.userData.lastMove=Date.now();this.dirty=true;return;
    }
    if(anchor){this.poleAnchors.delete(m);clearPodium(m);}
    const walking = Math.hypot(p.x - m.x, p.z - m.z) > 0.025;
    Object.assign(m, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    if (m.trainSlot === 0) {
      this.train.step(p);
      for (const id of this.train.riders.keys()) {
        if (id === m.id) continue;
        const rider = this.members.get(id);
        if (!rider) continue; // AI poses are sampled directly from the train path.
        const next = this.train.pose(id);
        if (this.positionMember(id, rider, next)) Object.assign(rider, next);
        else this.leaveTrain(id);
      }
    } else if (walking) {
      m.action = 'walk';
      this.react(m, 'wave');
    } else if (m.action === 'walk') m.action = 'idle';
    c.userData.lastMove = Date.now();
    this.dirty = true;
  }
  onJoin(client, { identity, restore, transfer, expires }) {
    const old = connected.get(identity);
    if (old && (!transfer || old.room === this)) throw Error('Already joined');
    if (expires && Date.now() >= expires) throw Error('Session expired');
    if (old) {
      old.room.removeMember(old.client, false);
      old.client.leave(4001);
    }
    const previous = recent.get(identity);
    let place = restore && previous?.room === this.roomId ? previous.place : floorEntry;
    if (!this.positionMember(client.sessionId, null, place)) {
      place = floorEntry;
      this.positionMember(client.sessionId, null, place);
    }
    const m = {
      ...profile(identity),
      ...place,
      id: client.sessionId,
      ai: false,
      action: 'idle',
      seat: null,
      table: null,
    };
    client.userData = { identity, lastMove: Date.now() };
    this.members.set(client.sessionId, m);
    connected.set(identity, { room: this, client });
    pending.delete(identity);
    recent.delete(identity);
    if (expires)
      client.userData.expiry = this.clock.setTimeout(
        () => client.leave(4003),
        Math.max(0, expires - Date.now()),
      );
    this.refreshVisitors();
    this.broadcast('occupancy', this.population());
    this.dirty = true;
  }
  removeMember(client, remember) {
    if (!client.userData) return;
    const m = this.member(client);
    if (!m) return;
    this.leaveTrain(client.sessionId);
    client.userData.expiry?.clear();
    const { identity } = client.userData;
    this.zones.move(
      'human',
      client.sessionId,
      this.zones.location('human', client.sessionId),
      null,
    );
    this.podiumClaims.delete(client.sessionId);
    this.birthdays?.leave(client.sessionId);
    this.members.delete(client.sessionId);
    this.birthdayState?.();
    if (connected.get(identity)?.client === client) connected.delete(identity);
    if (remember) {
      const { x, y, z, yaw } = m;
      const entry = { room: this.roomId, place: m.seat === null ? { x, y, z, yaw } : floorEntry };
      recent.set(identity, entry);
      setTimeout(() => {
        if (recent.get(identity) === entry) recent.delete(identity);
      }, 60000).unref();
    }
    this.refreshVisitors();
    this.broadcast('occupancy', this.population());
    this.dirty = true;
  }
  onLeave(c, consented) {
    this.removeMember(c, !consented);
  }
  onDispose() {
    rooms.delete(this.roomId);
  }
}
