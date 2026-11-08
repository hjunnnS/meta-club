import { dances, danceButtons } from './free-dance.js';
import { initShop } from './shop.js';
import { musicPlayer } from './music.js';
const el = (id) => document.getElementById(id),
  map = document.querySelector('iframe');
const music = musicPlayer(
  (s) => (el('track').textContent = s),
  () => guide('music'),
  firstVisitFailure,
);
let needsPlace = true,
  room,
  snapshot,
  ready = false,
  joining = false,
  manual = false,
  retryTimer,
  attempts = 0,
  memberId;
const ignored = new Set();
let pendingReport, rosterKey;
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
function guide(step) {
  try {
    const key = 'edm-first-visit',
      log = JSON.parse(localStorage.getItem(key) || '{}');
    if (!log[step]) {
      log[step] = Date.now();
      localStorage.setItem(key, JSON.stringify(log));
    }
    el('guide').hidden = Boolean(log.dismissed || log.exit);
  } catch {
    el('guide').hidden = true;
  }
}
function display(data) {
  snapshot = data;
  if (data.zones) {
    const labels = { CLOSED: '닫힘', OPENING: '준비 중', OPEN: '열림', DRAINING: '퇴장 대기' };
    el('zones').textContent =
      '사이드존 ' + labels[data.zones[0]] + ' · 발코니 ' + labels[data.zones[1]];
  }
  const self = data.actors.find((a) => a.id === room.sessionId);
  selectDance(self?.action, self?.seat != null);
  if (self?.action === 'dance' || dances.has(self?.action)) guide('dance');
  const names = data.actors.filter((a) => !a.ai && a.id !== room.sessionId);
  const key = JSON.stringify(names.map((a) => [a.id, a.nickname]));
  if (key !== rosterKey) {
    rosterKey = key;
    const previous = el('people').value;
    el('people').replaceChildren(...names.map((a) => new Option(a.nickname, a.id)));
    if (names.some((a) => a.id === previous)) el('people').value = previous;
  }
  if (ready) {
    frame('actors', { ...data, self: room.sessionId });
    if (needsPlace) {
      const self = data.actors.find((a) => a.id === room.sessionId);
      if (self) {
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
  music.reset();
  room = undefined;
  snapshot = null;
  ready = false;
  map.hidden = true;
  map.removeAttribute('src');
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
    ignored.clear();
    music.reset();
    el('log').replaceChildren();
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
    next.onMessage('receipt', (m) => {
      if (m.request === pendingReport?.request) pendingReport = null;
      note('신고 번호 ' + m.id);
    });
    next.onMessage('clock', (m) => {
      if (room === next) {
        music.clock(m);
        if (ready) frame('clock', { offset: m.now - (Date.now() + m.sent) / 2, epoch: m.epoch });
      }
    });
    next.onMessage('blocked', (id) => {
      ignored.add(id);
      for (const li of el('log').children) if (li.dataset.id === id) li.hidden = true;
      note('차단했습니다.');
    });
    next.onMessage('chat', (m) => {
      if (room !== next || ignored.has(m.id)) return;
      if (m.id === room.sessionId) guide('chat');
      const li = document.createElement('li');
      li.dataset.id = m.id;
      li.textContent = m.nickname + ' · ' + m.body;
      el('log').append(li);
      if (el('log').children.length > 80) el('log').firstChild.remove();
      li.scrollIntoView({ block: 'nearest' });
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
  if (kind === 'scene-ready') {
    ready = true;
    el('event-controls').hidden = !memberId?.startsWith('local-test:');
    if (memberId?.startsWith('local-test:')) shop.channel(room.roomId, memberId);
    room.send('snapshot');
    room.send('clock', Date.now());
    if (snapshot) display(snapshot);
    frame('quality', el('quality').value);
  }
  if (kind === 'move' && ready) {
    room.send('move', data);
    if (Math.hypot(data.x, data.z - 25) > 0.5) guide('move');
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
el('event-controls').onclick = event => {
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
el('quality').onchange = (e) => frame('quality', e.target.value);
el('seat').onclick = () => room?.send('seat');
const selectDance = danceButtons(el('dance-options'), (action) => {
  room?.send('action', action);
  map.contentDocument?.querySelector('canvas')?.focus();
});
for (const b of document.querySelectorAll('[data-action]'))
  b.onclick = () => room?.send('action', b.dataset.action);
el('chat').onsubmit = (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  if (input.value.trim() && room) {
    room.send('chat', input.value);
    input.value = '';
  }
};
el('block').onclick = () => {
  if (el('people').value) room?.send('interaction', { kind: 'block', id: el('people').value });
};
el('report').onclick = () => {
  const id = el('people').value;
  if (!id || !room) return;
  if (pendingReport?.id !== id || pendingReport.channel !== room.roomId) {
    const reason = prompt('신고 사유');
    if (!reason?.trim()) return;
    if (reason.trim().length > 500) {
      note('신고 사유는 500자까지 입력할 수 있습니다.');
      return;
    }
    pendingReport = {
      kind: 'report',
      id,
      channel: room.roomId,
      note: reason.trim(),
      request: crypto.randomUUID(),
    };
  }
  room.send('interaction', pendingReport);
  note('신고 전송 중입니다. 접수 번호가 표시되지 않으면 다시 눌러 주세요.');
};
document.querySelector('a[href="/lobby"]').onclick = () => guide('exit');
el('dismiss').onclick = () => guide('dismissed');
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
enter(new URLSearchParams(location.search).get('channel') || undefined);
