import { enterClub, offerReentry } from './member-entry.js';
import { dances, danceButtons, danceCamera, animateDance } from '/clubs/edm/free-dance.js';
import { avatarFactory } from '/clubs/edm/avatar.js';
import { musicPlayer } from '/clubs/edm/music.js';

export async function startActivities({ B, scene, cam, canvas, engine, extras, eye, hint, nav }) {
  const room = await enterClub(nav, hint);
  if (!room) return;
  const make = avatarFactory(B, scene),
    models = new Map();
  const labels = {
    streetDance: '스트리트 댄스',
    battleDance: '배틀존 댄스',
    photo: '루프탑 포토존',
  };
  const spots = Object.entries(extras.placements).map(([key, xyz]) => {
    const at = B.Vector3.FromArray(xyz);
    const ring = B.MeshBuilder.CreateTorus(
      key,
      { diameter: 2.7, thickness: 0.055, tessellation: 40 },
      scene,
    );
    ring.position.copyFrom(at);
    ring.position.y += 0.05;
    ring.isPickable = false;
    const mat = new B.StandardMaterial(key, scene);
    mat.emissiveColor = B.Color3.FromHexString(key === 'photo' ? '#83dbea' : '#ffaf45');
    ring.material = mat;
    return { key, at };
  });
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
  const observe = new B.FreeCamera('activity camera', B.Vector3.Zero(), scene);
  observe.minZ = 0.08;
  let nearest,
    acting = false,
    lastSent = 0,
    lastPosition,
    epoch = Date.now(),
    offset = 0,
    joined = true;
  const action = button('활동 시작', () => {
    if (acting) room.send('activity', 'stop');
    else if (nearest) room.send('activity', nearest.key);
    canvas.focus();
  });
  const photo = button('사진 저장', () => {
    scene.render();
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'hiphop-rooftop.png';
    link.click();
  });
  photo.hidden = true;
  let free = false;
  const viewDance = danceCamera(B, scene);
  const selectDance = danceButtons(nav, (id) => {
    room.send('free-dance', id);
    canvas.focus();
  });
  const audio = button('시험 음악', () => music.start());
  nav.append(track);
  const status = document.createElement('p');
  hint.after(status);
  room.onMessage('notice', (m) => (status.textContent = m));
  room.onMessage('clock', (m) => {
    epoch = m.epoch;
    offset = m.now - (Date.now() + m.sent) / 2;
    music.clock(m);
  });
  room.onMessage('place', (p) => {
    cam.position.set(p.x, p.y + eye, p.z);
    lastPosition = undefined;
  });
  room.onMessage('snapshot', ({ actors, zones }) => {
    const states = { OPEN: '열림', CLOSED: '닫힘', OPENING: '준비 중', DRAINING: '퇴장 대기' };
    status.textContent = '채널 ' + room.roomId + ' · ' + actors.length + '명 · 배틀·스트리트 ' +
      states[zones[0]] + ' · 루프탑·크루 ' + states[zones[1]];
    const present = new Set();
    for (const a of actors) {
      present.add(a.id);
      const m = models.get(a.id) ?? make(a);
      models.set(a.id, m);
      m.actor = a;
      m.root.position.set(a.x, a.y, a.z);
      m.root.rotation.y = a.yaw;
      if (a.id !== room.sessionId) continue;
      free = dances.has(a.action);
      selectDance(a.action, Boolean(a.seat));
      acting = a.action !== 'idle';
      m.root.setEnabled(acting);
      if (free) viewDance(a);
      else if (acting) {
        observe.position.set(a.x + 2.1, a.y + 1.65, a.z + 2.3);
        observe.setTarget(new B.Vector3(a.x, a.y + 0.95, a.z));
        scene.activeCamera = observe;
      } else scene.activeCamera = cam;
      photo.hidden = a.action !== 'pose';
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
    offerReentry(nav, status);
    action.disabled = audio.disabled = true;
    photo.hidden = true;
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
    nearest = spots.find((s) => B.Vector3.Distance(s.at, foot) <= 1.65);
    hint.textContent = nearest
      ? labels[nearest.key]
      : 'WASD 이동 · 메인 홀과 배틀존에서 춤 · 루프탑에서 사진';
    action.disabled = !acting && !nearest;
    action.textContent = acting
      ? '활동 끝내기'
      : nearest
        ? labels[nearest.key] + ' 시작'
        : '활동 표시로 이동';
    if ((!acting || free) && performance.now() - lastSent >= 100) {
      const p = { x: foot.x, y: foot.y, z: foot.z, yaw: cam.rotation.y };
      if (!lastPosition || Object.keys(p).some((k) => Math.abs(p[k] - lastPosition[k]) > 0.001)) {
        room.send('move', p);
        lastPosition = p;
        lastSent = performance.now();
      }
    }
    const beat = Math.sin((Date.now() + offset - epoch) * 0.012566);
    for (const m of models.values()) {
      if (dances.has(m.actor.action)) {
        animateDance(m, m.actor.action, (Date.now() + offset - epoch) / 1000);
        continue;
      }
      m.near.position.x = 0;
      const dance = m.actor.action === 'dance',
        pose = m.actor.action === 'pose';
      m.near.position.y = dance ? 0.085 * Math.abs(beat) : 0;
      m.torso.rotation.z = dance ? 0.18 * beat : 0;
      m.limbs.forEach((j, i) => {
        const sign = i < 2 ? -1 : 1;
        j.rotation.z =
          i % 2 === 0
            ? sign * (pose ? (i === 2 ? 2.5 : 0.4) : dance ? 0.95 + 0.65 * beat : 0.12)
            : 0;
        j.rotation.x = dance ? sign * (i % 2 ? 0.26 : 0.43) * beat : 0;
      });
    }
  });
}
