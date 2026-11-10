import { dances, danceButtons } from './free-dance.js';
import { initShop } from './shop.js';
import { musicPlayer } from './music.js';
const el = (id) => document.getElementById(id),
  map = document.querySelector('iframe');
let audibleTrack = null;
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
  const names = {fountain:'분수 불꽃 시험',confetti:'종이조각 시험',laser:'레이저 쇼',phoenix:'불사조',whale:'대형 고래',dragon:'네온 용',jellyfish:'우주 해파리',butterflies:'나비 군집'};
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
  el('train-start').hidden = Boolean(data.trainLeader);
  el('train-join').hidden = !data.trainLeader || riding;
  el('train-leave').hidden = !riding;
  el('train-leave').textContent = data.trainLeader === self?.id ? '기차 종료' : '기차 내리기';
  const trainHint = !data.trainLeader ? '아직 운행 전입니다.'
    : !riding ? (self?.seat != null ? '자리에서 일어나면 합류할 수 있습니다.' : '운행 중입니다. 합류하면 선두를 따라갑니다.')
    : data.trainLeader === self?.id ? '선두입니다. 플로어 밖으로 나가려면 기차 종료를 누르세요.' : '탑승 중입니다. 원할 때 내릴 수 있습니다.';
  if (el('train-hint').textContent !== trainHint) el('train-hint').textContent = trainHint;
  el('train-join').disabled = !memberId || self?.seat != null;
  el('seat').disabled = riding;
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
  firstVisitFailure(message);
  shop.channel(null);
  el('event-controls').hidden = true;
  el('particle-tests').hidden = true;
  music.reset();
  room = undefined;
  snapshot = null;
  ready = false;
  showMusic(null);
  map.hidden = true;
  map.removeAttribute('src');
  for (const id of ['train-start', 'train-join', 'train-leave']) el(id).hidden = true;
  el('train-hint').textContent = '채널 연결을 기다리는 중입니다.';
  el('performance').textContent = '';
  el('population').textContent = message;
  el('retry').hidden = false;
  if (reconnect && !manual && attempts < 4) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => enter(), 1000 * ++attempts);
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
    if (!res.ok) throw Error('입장 가능한 자리가 없거나 세션이 만료됐습니다.');
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
    map.src = '/stage/festival/index.html?live';
    map.hidden = false;
    el('guide-guest').hidden = Boolean(memberId);
    guide('entry');
    list().catch(() => {});
  } catch (error) {
    if (old && room === old) {
      firstVisitFailure(error.message);
      note(error.message);
    } else disconnected(error.message, false);
  } finally {
    joining = false;
  }
}
window.addEventListener('message', (event) => {
  if (!room || event.source !== map.contentWindow || event.origin !== location.origin) return;
  const { kind, data } = event.data || {};
  if (kind === 'gate-notice') note(data);
  if (kind === 'scene-ready') {
    ready = true;
    showMusic(audibleTrack);
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
  if (ready && event.target.closest('[data-strobe-preview]')) {
    frame('strobe-preview');
    return;
  }
  const kind = event.target.closest('[data-event]')?.dataset.event;
  if (kind && ready) room?.send('preview-event', { kind, message: el('event-message').value });
};
el('retry').onclick = () => {
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
for (const action of ['start','join','leave'])
  el('train-' + action).onclick = () => room?.send('train', action);
el('wand').onclick = () => room?.send('wand', el('wand').getAttribute('aria-pressed') !== 'true');
el('other-wands').onchange = e => frame('other-wands', e.target.checked);
el('seat').onclick = () => room?.send('seat');
const selectDance = danceButtons(el('dance-options'), (action) => {
  room?.send('action', action);
  map.contentDocument?.querySelector('canvas')?.focus();
});
for (const b of document.querySelectorAll('[data-action]'))
  b.onclick = () => room?.send('action', b.dataset.action);
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
setInterval(() => { if (ready && !document.hidden) frame('music-spectrum', music.spectrum()); }, 50);
enter(new URLSearchParams(location.search).get('channel') || undefined);
