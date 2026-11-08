import { socialTables } from './tables.js';
import { dances, danceButtons, danceCamera, animateDance } from '/clubs/edm/free-dance.js';
import { avatarFactory } from '/clubs/edm/avatar.js';
import { musicPlayer } from '/clubs/edm/music.js';

export async function startTables({ B, scene, cam, canvas, extras, eye, hint, nav }) {
  const sdk = document.createElement('script');
  sdk.src = '/clubs/edm/sdk.js';
  await new Promise((resolve, reject) => {
    sdk.onload = resolve;
    sdk.onerror = reject;
    document.head.append(sdk);
  });
  const admission = await fetch('./admission', { method: 'POST' });
  if (!admission.ok) throw Error('소셜 라운지 채널에 입장하지 못했습니다. 로비에서 다시 입장해 주세요.');
  const room = await new Colyseus.Client('wss://' + location.host).consumeSeatReservation(
    await admission.json(),
  );
  const make = avatarFactory(B, scene),
    models = new Map();

  const names = {
    main: '메인 라운지',
    garden: '정원',
    roof: '루프탑 테라스',
    vip: 'VIP 테라스',
    booths: '부스',
    cafe: '카페',
  };
  const tables = socialTables(extras),
    seats = tables.flatMap((t) => t.seats);
  const wood = new B.StandardMaterial('oak', scene);
  wood.diffuseColor = B.Color3.FromHexString('#9b6445');
  const cushion = new B.StandardMaterial('sage', scene);
  cushion.diffuseColor = B.Color3.FromHexString('#6d927e');
  for (const {
    center: [x, y, z],
    seats,
  } of tables) {
    for (const [name, diameter, height, dy] of [
      ['top', 1.45, 0.1, 0.79],
      ['pillar', 0.24, 0.76, 0.38],
    ]) {
      const mesh = B.MeshBuilder.CreateCylinder(
        'wall/table ' + name,
        { diameter, height, tessellation: 28 },
        scene,
      );
      if (name === 'top') {
        const dx = seats[1].x - seats[0].x,
          dz = seats[1].z - seats[0].z;
        mesh.scaling.z = Math.max(1, (Math.hypot(dx, dz) - 0.9) / diameter);
        mesh.rotation.y = Math.atan2(dx, dz);
      }
      mesh.position.set(x, y + dy, z);
      mesh.material = wood;
    }
    for (const seat of seats) {
      const stool = B.MeshBuilder.CreateCylinder(
        'wall/stool',
        { diameter: 0.66, height: 0.44, tessellation: 20 },
        scene,
      );
      stool.position.set(seat.x, seat.y + 0.22, seat.z);
      stool.material = cushion;
    }
  }
  const button = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    nav.append(b);
    return b;
  };
  const track = document.createElement('span');
  const music = musicPlayer(
    (t) => (track.textContent = t),
    () => {},
    () => {},
  );

  const observe = new B.FreeCamera('table camera', B.Vector3.Zero(), scene);
  observe.minZ = 0.07;
  let nearest,
    acting = false,
    currentTable,
    occupied = new Set(),
    lastSent = 0,
    lastPosition,
    joined = true;
  const action = button('가까운 자리에 앉기', () => {
    if (acting) room.send('stand');
    else if (nearest) room.send('sit', nearest.id);
    canvas.focus();
  });
  let free = false;
  const viewDance = danceCamera(B, scene);
  const selectDance = danceButtons(nav, (id) => {
    room.send('free-dance', id);
    canvas.focus();
  });
  const audio = button('시험 음악', () => music.start());
  nav.append(track);
  const status = document.createElement('p'),
    notice = document.createElement('p');
  hint.after(status, notice);
  const form = document.createElement('form');
  form.id = 'conversation';
  form.hidden = true;
  form.innerHTML =
    '<strong></strong><ul aria-live="polite"></ul><input maxlength="320" aria-label="테이블 메시지" required><button>보내기</button>';
  document.body.append(form);
  const log = form.querySelector('ul'),
    input = form.querySelector('input');
  form.onsubmit = (e) => {
    e.preventDefault();
    if (input.value.trim()) {
      room.send('table-chat', input.value);
      input.value = '';
    }
  };
  room.onMessage('table-chat', (m) => {
    if (m.table !== currentTable) return;
    const line = document.createElement('li');
    line.textContent = m.nickname + ' · ' + m.body;
    log.append(line);
    if (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  });
  room.onMessage('notice', (m) => (notice.textContent = m));
  let clockOffset = 0,
    epoch = Date.now();
  room.onMessage('clock', (m) => {
    epoch = m.epoch;
    clockOffset = m.now - (Date.now() + m.sent) / 2;
    music.clock(m);
  });
  room.onMessage('place', (p) => {
    cam.position.set(p.x, p.y + eye, p.z);
    lastPosition = undefined;
  });
  room.onMessage('snapshot', ({ actors, zones }) => {
    const states = { OPEN: '열림', CLOSED: '닫힘', OPENING: '준비 중', DRAINING: '퇴장 대기' };
    status.textContent = '채널 ' + room.roomId + ' · ' + actors.length + '명 · 정원·부스 ' + states[zones[0]] + ' · 테라스 ' + states[zones[1]];
    occupied = new Set(actors.map((a) => a.seat));
    const present = new Set();
    for (const a of actors) {
      present.add(a.id);
      const m = models.get(a.id) ?? make(a);
      models.set(a.id, m);
      m.actor = a;
      m.root.position.set(a.x, a.y, a.z);
      m.root.rotation.y = a.yaw;
      m.label.scaling.setAll(0.65);
      m.near.position.x = 0;
      m.torso.rotation.z = 0;
      m.near.position.y = a.seat ? -0.31 : 0;
      m.limbs.forEach((joint, i) => {
        joint.rotation.z = 0;
        joint.rotation.x = a.seat ? (i % 2 ? -1.36 : -0.35) : 0;
      });
      if (a.id !== room.sessionId) continue;
      free = dances.has(a.action);
      selectDance(a.action, Boolean(a.seat));
      acting = Boolean(a.seat);
      m.root.setEnabled(acting || free);
      if (currentTable !== a.table) {
        log.replaceChildren();
        input.value = '';
        notice.textContent = '';
        currentTable = a.table;
      }
      form.hidden = !acting;
      if (acting) {
        const t = tables.find((t) => t.id === a.table),
          [x, y, z] = t.center;
        const [cx, , cz] = extras.zones[t.id].center;
        const dir = new B.Vector3(cx - x, 0, cz - z).normalize();
        observe.position.set(x - dir.x * 4.7, y + 3.2, z - dir.z * 4.7);
        observe.setTarget(new B.Vector3(x, y + 0.9, z));
        scene.activeCamera = observe;
        form.querySelector('strong').textContent = names[a.table] + ' 테이블 대화';
      } else if (free) viewDance(a);
      else scene.activeCamera = cam;
    }
    for (const [id, m] of models)
      if (!present.has(id)) {
        m.dispose();
        models.delete(id);
      }
  });
  room.onLeave(() => {
    joined = false;
    selectDance(null, true);
    music.reset();
    action.disabled = audio.disabled = true;
    form.hidden = true;
    status.textContent = '연결 종료 · 로비에서 다시 입장하세요.';
  });
  room.send('snapshot');
  room.send('clock', Date.now());
  const timer = setInterval(() => {
    if (joined) {
      room.send('clock', Date.now());
      music.tick();
    }
  }, 2500);
  window.addEventListener(
    'pagehide',
    () => {
      clearInterval(timer);
      music.reset();
      if (joined) room.leave();
    },
    { once: true },
  );
  window.addEventListener('pageshow', event => {
    if (event.persisted) location.reload();
  });
  scene.onBeforeRenderObservable.add(() => {
    if (!joined) return;
    const foot = new B.Vector3(cam.position.x, cam.position.y - eye, cam.position.z);

    for (const m of models.values())
      if (dances.has(m.actor.action))
        animateDance(m, m.actor.action, (Date.now() + clockOffset - epoch) / 1000);
    nearest = seats
      .filter((s) => !occupied.has(s.id))
      .map((s) => ({ s, d: Math.hypot(foot.x - s.x, foot.y - s.y, foot.z - s.z) }))
      .filter((v) => v.d <= 1.65)
      .sort((a, b) => a.d - b.d)[0]?.s;
    action.disabled = !acting && !nearest;
    action.textContent = acting ? '일어서기' : '가까운 자리에 앉기';
    hint.textContent = acting
      ? names[currentTable] + ' 테이블'
      : nearest
        ? names[nearest.table] + ' · 빈 자리'
        : 'WASD 이동 · 테이블 가까이에서 착석';
    if ((!acting || free) && performance.now() - lastSent >= 100) {
      const p = { x: foot.x, y: foot.y, z: foot.z, yaw: cam.rotation.y };
      if (!lastPosition || Object.keys(p).some((k) => Math.abs(p[k] - lastPosition[k]) > 0.001)) {
        room.send('move', p);
        lastPosition = p;
        lastSent = performance.now();
      }
    }
  });
}
