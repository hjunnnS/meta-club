import {rhythmGame} from './rhythm-game.js';
import { nearbyEdmSeats, edmSeats, nearbyEdmPole } from './edm-layout.js';
import { dances, danceButtons } from './free-dance.js';
import { initShop } from './shop.js';
import { musicPlayer } from './music.js';
const el = (id) => document.getElementById(id),
  map = document.querySelector('iframe');
let rhythm;
let audibleTrack = null;
let loginRequired = false;
function showMusic(id) {
  audibleTrack = id;
  el('music').textContent = id ? '음악 재생 중' : '음악 시작';
  el('music').classList.toggle('awaiting', ready && !id);
  if (ready) frame('audible-track', id);
}
const music = musicPlayer(
  (s) => (el('track').textContent = s),
  id => { showMusic(id); guide('music'); },
  reason => { showMusic(null); firstVisitFailure(reason); },
);
let visitOrigin;
let needsPlace = true,
  room,
  snapshot,
  ready = false,
  sceneLoaded = false,
  joining = false,
  manual = false,
  retryTimer,
  attempts = 0,
  memberId;
function note(message) {
  el('notice').textContent = message;
}
function firstVisitFailure(reason) {
  try {
    const key = 'edm-first-visit',
      log = JSON.parse(localStorage.getItem(key) || '{}');
    if (!log.exit) {
      log.lastFailure = { reason, at: Date.now() };
      localStorage.setItem(key, JSON.stringify(log));
    }
  } catch {}
}
const frame = (kind, data) => map.contentWindow?.postMessage({ kind, data }, location.origin);
const shop = initShop(frame);
let guideOpened = false;
function showGuide(open) {
  el('guide').hidden = !open;
  el('show-guide').setAttribute('aria-expanded', String(open));
}
function guide(step) {
  try {
    const key = 'edm-first-visit',
      log = JSON.parse(localStorage.getItem(key) || '{}');
    if (!log[step]) {
      log[step] = Date.now();
      localStorage.setItem(key, JSON.stringify(log));
    }
    if (step === 'entry') showGuide(guideOpened);
  } catch {
    if (step === 'entry') showGuide(guideOpened);
  }
}
function display(data) {
  snapshot = data;
  const names = {fountain:'분수 불꽃 시험',confetti:'종이조각 · 안에서 밖','confetti-down':'종이조각 · 위에서 아래','confetti-in':'종이조각 · 밖에서 안',laser:'레이저 쇼',phoenix:'불사조',whale:'대형 고래',dragon:'네온 용',jellyfish:'우주 해파리',butterflies:'나비 군집'};
  const next = data.nextPerformance;
  const seconds = next ? Math.max(0, Math.ceil((next.start - data.performanceNow) / 1000)) : 0;
  const countdown = next ? '다음 ' + names[next.kind] + ' · ' + Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0') : '';
  el('performance').textContent = data.stageEvent && data.stageEvent.kind !== 'led'
    ? names[data.stageEvent.kind] + ' 공연 중' + (countdown ? ' · ' + countdown : '') : countdown;
  if (data.zones) {
    const labels = { CLOSED: '닫힘', OPENING: '준비 중', OPEN: '열림', DRAINING: '퇴장 대기' };
    el('zones').textContent =
      '사이드존 ' + labels[data.zones[0]] + ' · 발코니 ' + labels[data.zones[1]];
  }
  const self = data.actors.find((a) => a.id === room.sessionId);
  el('wand').textContent = self?.wand ? '무드봉 내리기' : '무드봉 들기';
  el('wand').setAttribute('aria-pressed', String(Boolean(self?.wand)));
  const riding = self?.trainSlot != null;
  el('train-join').hidden = !data.trainLeader || riding;
  el('train-leave').hidden = !riding;
  el('train-leave').textContent = data.trainLeader === self?.id ? '기차 종료' : '기차 내리기';
  const trainHint = !data.trainLeader ? '아직 운행 전입니다.'
    : !riding ? (self?.seat != null ? '자리에서 일어나면 합류할 수 있습니다.' : '운행 중입니다. 합류하면 선두를 따라갑니다.')
    : data.trainLeader === self?.id ? '선두입니다. 플로어 밖으로 나가려면 기차 종료를 누르세요.' : '탑승 중입니다. 원할 때 내릴 수 있습니다.';
  if (el('train-hint').textContent !== trainHint) el('train-hint').textContent = trainHint;
  el('train-join').disabled = !memberId || self?.seat != null;
  const occupied = new Set(data.actors.filter(a=>!a.ai).map(a=>a.seat));
  const nearest = nearbyEdmSeats(self).find(({index})=>!occupied.has(index));
  const sitting = self?.seat != null;
  el('seat').hidden = !sitting && (!nearest || riding);
  const sittingLabel=sitting?edmSeats[self.seat]?.label:null;
  el('seat').textContent = sitting ? (sittingLabel?sittingLabel+' 일어나기':self.table ? self.table+'번 테이블 일어나기' : '일어나기')
    : nearest?.seat.label ? nearest.seat.label+' 앉기' : nearest?.seat.table ? nearest.seat.table+'번 테이블 앉기' : '바 의자 앉기';
  el('seat').dataset.seat = nearest ? String(nearest.index) : '';
  el('seat').disabled = riding;
  const poleActive=self?.action==='pole-dance';
  el('pole-dance').hidden=!poleActive&&!nearbyEdmPole(self);
  el('pole-dance').disabled=!self||sitting||riding;
  el('pole-dance').textContent=poleActive?'봉 놓기':'봉 잡고 춤추기';
  el('pole-dance').setAttribute('aria-pressed',String(poleActive));
  selectDance(self?.action, self?.seat != null || riding);
  if (self?.action === 'dance' || dances.has(self?.action)) guide('dance');
  if (ready) {
    frame('actors', { ...data, self: room.sessionId });
    if (needsPlace) {
      const self = data.actors.find((a) => a.id === room.sessionId);
      if (self) {
        visitOrigin = { x: self.x, z: self.z };
        frame('place', self);
        needsPlace = false;
      }
    }
  }
}
function disconnected(message, reconnect) {
  rhythm?.interrupt('연결이 끊겨 라운드를 중단했습니다.');
  firstVisitFailure(message);
  shop.channel(null);
  el('event-controls').hidden = true;
  el('particle-tests').hidden = true;
  music.reset();
  room = undefined;
  snapshot = null;
  ready = false;
  showMusic(null);
  // Keep the last rendered club visible during a temporary channel outage.
  frame('connection-state', false);
  frame('audible-track', null);
  if (!sceneLoaded) map.hidden = true;
  el('seat').hidden = true;
  for (const id of ['train-join', 'train-leave']) el(id).hidden = true;
  el('train-hint').textContent = '채널 연결을 기다리는 중입니다.';
  el('performance').textContent = '';
  el('population').textContent = message;
  el('retry').hidden = false;
  el('retry').textContent = loginRequired ? '시험 회원 다시 로그인' : '다시 입장';
  if (reconnect && !loginRequired && !manual && attempts < 4) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => enter(), 1000 * 2 ** attempts++);
  } else if (reconnect && attempts >= 4) {
    el('population').textContent = '연결을 복구하지 못했습니다. 다시 입장을 눌러 주세요.';
  }
}
async function list() {
  const res = await fetch('/api/lobby');
  if (!res.ok) return;
  const data = await res.json(),
    select = el('channels'),
    prev = select.value;
  const channels = data.clubs.find((c) => c.id === 'edm').channels;
  select.replaceChildren(
    ...channels.map(
      (c) => new Option(c.channelId + ' (' + c.people + '/' + c.capacity + ')', c.channelId),
    ),
  );
  select.value = channels.some((c) => c.channelId === prev) ? prev : room?.roomId || '';
}
async function enter(channelId) {
  if (joining || manual) return;
  joining = true;
  clearTimeout(retryTimer);
  el('retry').hidden = true;
  const old = room;
  try {
    const session = await (await fetch('/api/session')).json();
    if (memberId && memberId !== session.user?.id)
      throw Error('로그인 세션이 바뀌었습니다. 로비에서 다시 입장해 주세요.');
    memberId = session.user?.id;
    const res = await fetch('/clubs/edm/admission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    if (!res.ok) {
      const failure = await res.json().catch(() => ({}));
      loginRequired = res.status === 401;
      if (loginRequired)
        throw Error('로그인 정보가 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.');
      if (res.status === 403) throw Error('현재 접속 주소에서 입장 요청이 허용되지 않았습니다.');
      if (res.status === 409) throw Error('선택한 채널에 입장할 수 없습니다. 자동 입장으로 다시 시도해 주세요.');
      throw Error('입장 요청 실패 (HTTP ' + res.status + (failure.error ? ' · ' + failure.error : '') + ')');
    }
    loginRequired = false;
    const a = await res.json();
    if (a.status === 'already_joined' && old?.roomId === a.channelId) return;
    if (a.status !== 'reserved')
      throw Error(
        a.status === 'already_joined'
          ? '이미 다른 화면에서 입장했습니다.'
          : '다른 입장 처리가 진행 중입니다.',
      );
    const next = await new Colyseus.Client('wss://' + location.host).consumeSeatReservation(a.seat);
    shop.channel(null);
    room = next;
    el('retry').hidden = true;
    ready = false;
    needsPlace = true;
    snapshot = null;
    attempts = 0;
    showMusic(null);
    music.reset();
    note('');
    next.onMessage('occupancy', ({ channelId, people, capacity }) => {
      if (room === next)
        el('population').textContent =
          '채널 ' + channelId + ' · ' + people + ' / ' + capacity + '명';
    });
    next.onMessage('snapshot', (m) => {
      if (room === next) display(m);
    });
    next.onMessage('place', (m) => {
      if (room === next && ready) frame('place', m);
    });
    next.onMessage('notice', note);
    next.onMessage('clock', (m) => {
      if (room === next) {
        music.clock(m);
        if (ready) frame('clock', { offset: m.now - (Date.now() + m.sent) / 2, epoch: m.epoch, tracks: m.tracks });
      }
    });
    next.onLeave((code) => {
      if (room === next)
        disconnected(
          code === 4003 ? '세션이 만료됐습니다.' : '채널 연결이 종료됐습니다.',
          code !== 4001 && code !== 4003,
        );
    });
    next.send('occupancy');
    next.send('snapshot');
    next.send('clock', Date.now());
    if (!sceneLoaded) map.src = '/stage/festival/index.html?live';
    else {
      ready = true;frame('connection-state', true);
      el('event-controls').hidden = !memberId?.startsWith('local-test:');
      el('particle-tests').hidden = !memberId?.startsWith('local-test:');
      if (memberId?.startsWith('local-test:')) shop.channel(room.roomId, memberId);
    }
    map.hidden = false;
    el('guide-guest').hidden = Boolean(memberId);
    guide('entry');
    list().catch(() => {});
  } catch (error) {
    if (old && room === old) {
      firstVisitFailure(error.message);
      note(error.message);
    } else disconnected(error.message === 'Failed to fetch' ? '서버에 다시 연결하는 중입니다.' : error.message, error instanceof TypeError);
  } finally {
    joining = false;
  }
}
window.addEventListener('message', (event) => {
  if (!room || event.source !== map.contentWindow || event.origin !== location.origin) return;
  const { kind, data } = event.data || {};
  if (kind === 'gate-notice') note(data);
  if (kind === 'seat-request' && ready && Number.isInteger(data)) room.send('seat',data);
  if (kind === 'scene-error') {
    sceneLoaded = false;
    ready = false;
    needsPlace = true;
    note('공간을 불러오지 못했습니다. 화면의 ‘장면 다시 열기’를 눌러 주세요. ' + String(data));
  }
  if (kind === 'scene-ready') {
    sceneLoaded = true;
    frame('connection-state', true);
    frame('game-active',Boolean(rhythm?.active));
    note('');
    ready = true;
    showMusic(audibleTrack);
    const observe=new URLSearchParams(location.search).get('view');
    if(observe==='speakers')frame('speaker-view');
    if(['bartender','dj'].includes(observe))frame('staff-view',observe);
    const floor = map.contentDocument?.querySelector('canvas');
    floor?.addEventListener('pointerdown', () => el('music').click(), { once: true });
    el('event-controls').hidden = !memberId?.startsWith('local-test:');
    el('particle-tests').hidden = !memberId?.startsWith('local-test:');
    if (memberId?.startsWith('local-test:')) shop.channel(room.roomId, memberId);
    room.send('snapshot');
    room.send('clock', Date.now());
    if (snapshot) display(snapshot);
    frame('fast-flash', el('fast-flash').checked);
    frame('quality', el('quality').value);
    frame('other-wands', el('other-wands').checked);
  }
  if(kind==='pole-grip'&&ready)room.send('pole-grip',data);
  if(kind==='pole-action'&&ready&&['pole-dance','idle'].includes(data))room.send('action',data);
  if (kind === 'move' && ready) {
    room.send('move', data);
    if (visitOrigin && Math.hypot(data.x - visitOrigin.x, data.z - visitOrigin.z) > 0.5) guide('move');
  }
  if (kind === 'render-info') {
    el('info').textContent =
      'AI 화면 ' +
      data.visibleAI +
      ' / 채널 ' +
      data.ai +
      ' · ' +
      Math.round(data.ms) +
      ' ms · ' +
      (data.quality === 'low' ? '낮음' : '높음');
    try {
      const key = 'edm-render-history',
        samples = JSON.parse(sessionStorage.getItem(key) || '[]');
      samples.push({ at: Date.now(), channel: room.roomId, mode: el('quality').value, ...data });
      sessionStorage.setItem(key, JSON.stringify(samples.slice(-60)));
    } catch {}
  }
});
el('particle-tests').onclick = el('event-controls').onclick = event => {
  const moving=event.target.closest('[data-moving-preview]');
  if(ready&&moving){frame('moving-preview',moving.dataset.movingPreview);return;}
  const accent=event.target.closest('[data-accent-preview]');
  if(ready&&accent){frame('accent-preview',accent.dataset.accentPreview);return;}
  const effect=event.target.closest('[data-peripheral-preview]');
  if(ready&&effect){frame('peripheral-preview',effect.dataset.peripheralPreview);return;}
  const strobe = event.target.closest('[data-strobe-preview]');
  if (ready && strobe) {
    frame('strobe-preview', strobe.dataset.strobePreview);
    return;
  }
  const kind = event.target.closest('[data-event]')?.dataset.event;
  if (kind && ready) room?.send('preview-event', { kind, message: el('event-message').value });
};
el('retry').onclick = () => {
  if (loginRequired) {
    location.assign('/auth/signin?callbackUrl=' + encodeURIComponent('/clubs/edm'));
    return;
  }
  attempts = 0;
  enter();
};
el('switch').onclick = () => {
  if (el('channels').value) enter(el('channels').value);
};
el('music').onclick = () => {
  music.start();
  room?.send('clock', Date.now());
};
el('fast-flash').onchange = e => frame('fast-flash', e.target.checked);
el('quality').onchange = (e) => frame('quality', e.target.value);
for (const action of ['join','leave'])
  el('train-' + action).onclick = () => room?.send('train', action);
el('pole-dance').onclick=()=>frame('pole-dance-request');
el('wand').onclick = () => room?.send('wand', el('wand').getAttribute('aria-pressed') !== 'true');
el('other-wands').onchange = e => frame('other-wands', e.target.checked);
el('seat').onclick = () => room?.send('seat', el('seat').dataset.seat === '' ? undefined : Number(el('seat').dataset.seat));
const selectDance = danceButtons(el('dance-options'), (action) => {
  frame('cancel-pole-approach');
  room?.send('action', action);
  map.contentDocument?.querySelector('canvas')?.focus();
});
for (const b of document.querySelectorAll('[data-action]'))
  b.onclick = () => {frame('cancel-pole-approach');room?.send('action', b.dataset.action);};
document.querySelector('a[href="/lobby"]').onclick = () => guide('exit');
el('show-guide').onclick = () => {
  if (!el('guide').hidden) return el('dismiss').click();
  guideOpened = true;
  showGuide(true);
  el('music').focus();
};
el('dismiss').onclick = () => {
  guideOpened = false;
  guide('dismissed');
  showGuide(false);
  el('show-guide').focus();
};
rhythm=rhythmGame({music,
  startMusic:async()=>{if(room)room.send('clock',Date.now());await music.start();},
  canPlay:()=>Boolean(memberId&&room&&ready),
  lock:active=>frame('game-active',active)});
el('rhythm-open').onclick=()=>rhythm.open();
function resume() {
  if (document.hidden || manual) return;
  frame('resume');
  if (room) {
    room.send('clock', Date.now());
    room.send('snapshot');
  } else enter();
}
document.addEventListener('visibilitychange', resume);
window.addEventListener('online', resume);
window.visualViewport?.addEventListener(
  'resize',
  () => (document.body.style.height = visualViewport.height + 'px'),
);
window.addEventListener('pagehide', () => {
  manual = true;
  clearTimeout(retryTimer);
  room?.leave();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
setInterval(() => {
  if (room && !document.hidden) {
    room.send('clock', Date.now());
    list().catch(() => {});
  }
}, 5000);
setInterval(() => music.tick(), 200);
setInterval(() => { if (ready && !document.hidden) {
  frame('music-spectrum', music.spectrum());
  const status=music.status();
  frame('music-output-clock',{playing:status.playing,id:status.track?.id,time:status.time,sentAt:Date.now()});
} }, 50);
enter(new URLSearchParams(location.search).get('channel') || undefined);
