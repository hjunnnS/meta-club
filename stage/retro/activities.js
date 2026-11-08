import { enterClub, offerReentry } from './member-entry.js';
import { dances, danceButtons, danceCamera, animateDance } from '/clubs/edm/free-dance.js';
import { avatarFactory, playerView } from '/clubs/edm/avatar.js';
import { musicPlayer } from '/clubs/edm/music.js';

// One textured mirror surface and one rotating mesh of floor highlights.
function mirrorBall(B, scene, xyz) {
  const ball = B.MeshBuilder.CreateSphere('mirror ball', { diameter: 1.75, segments: 22 }, scene);
  ball.position.set(...xyz);
  const surface = new B.StandardMaterial('mirror tiles', scene);
  const tex = new B.DynamicTexture('silver mosaic', { width: 768, height: 384 }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#25243b';
  ctx.fillRect(0, 0, 768, 384);
  const palette = ['#8899ba', '#b4add4', '#f1d3ee', '#c6e9f2', '#edf0ff', '#68678c'];
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 32; col++) {
      ctx.fillStyle = palette[(col * 17 + row * 11 + (col ^ row) * 3) % palette.length];
      ctx.fillRect(col * 24 + 1, row * 24 + 1, 22, 22);
    }
  tex.update();
  surface.diffuseTexture = tex;
  surface.emissiveTexture = tex;
  surface.emissiveColor = new B.Color3(0.52, 0.52, 0.6);
  surface.specularPower = 80;
  ball.material = surface;
  const stem = B.MeshBuilder.CreateCylinder('suspension', { diameter: 0.045, height: 2.2 }, scene);
  stem.position.copyFrom(ball.position);
  stem.position.y += 1.98;
  const shaft = new B.StandardMaterial('brushed metal', scene);
  shaft.diffuseColor = new B.Color3(0.28, 0.24, 0.3);
  stem.material = shaft;
  const dots = [];
  for (let i = 0; i < 48; i++) {
    const angle = i * 2.39996,
      r = 1.5 + 4.8 * ((i % 17) / 17);
    const dot = B.MeshBuilder.CreateDisc(
      'reflected light',
      { radius: 0.09 + 0.05 * (i % 3), tessellation: 8, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    dot.rotation.x = Math.PI / 2;
    dot.scaling.x = 1.5;
    dot.position.set(r * Math.cos(angle), 0.018, r * Math.sin(angle));
    dots.push(dot);
  }
  const reflections = B.Mesh.MergeMeshes(dots, true);
  reflections.name = 'mirror reflections';
  const glow = new B.StandardMaterial('reflected silver', scene);
  glow.disableLighting = true;
  glow.emissiveColor = new B.Color3(0.84, 0.77, 1);
  glow.alpha = 0.8;
  reflections.material = glow;
  reflections.position.set(xyz[0], 0, xyz[2]);
  reflections.isPickable = false;
  const key = new B.PointLight(
    'mirror pin light',
    ball.position.add(new B.Vector3(2, 1.2, 2)),
    scene,
  );
  key.diffuse = new B.Color3(0.67, 0.77, 1);
  key.intensity = 15;
  key.range = 11;
  scene.getLightByName('sky').intensity = 0.7;
  scene.getLightByName('sun').intensity = 0.85;
  return (seconds) => {
    const angle = ((seconds % 16) * Math.PI) / 8;
    ball.rotation.y = angle;
    reflections.rotation.y = angle;
  };
}

export async function startDisco({ B, scene, cam, canvas, extras, eye, hint, nav }) {
  const room = await enterClub(nav, hint);
  if (!room) return;
  const make = avatarFactory(B, scene),
    models = new Map();
  const animateBall = mirrorBall(B, scene, extras.placements.mirrorBall);
  const labels = {
    mainDance: '중앙 홀 디스코',
    danceA: '보조 홀 A 디스코',
    danceB: '보조 홀 B 디스코',
  };
  const spots = Object.keys(labels).map((key) => {
    const at = B.Vector3.FromArray(extras.placements[key]);
    const ring = B.MeshBuilder.CreateTorus(
      key,
      { diameter: 2.7, thickness: 0.055, tessellation: 40 },
      scene,
    );
    ring.position.copyFrom(at);
    ring.position.y += 0.05;
    ring.isPickable = false;
    const mat = new B.StandardMaterial(key, scene);
    mat.emissiveColor = B.Color3.FromHexString('#ffb8da');
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
  observe.fov = 1.28;
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
  let free = false;
  const view = playerView(B, scene, cam, canvas, eye, nav);
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
    status.textContent =
      '채널 ' + room.roomId + ' · ' + actors.length + '명 · 보조 홀 A ' + states[zones[0]] + ' · 보조 홀 B·라운지 ' + states[zones[1]];
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

      if (free) view.actor(m, viewDance(a));
      else if (acting) {
        observe.position.set(a.x + Math.sign(a.x) * 2, a.y + 2, a.z + 5.7);
        observe.setTarget(new B.Vector3(a.x * 0.72, a.y + 2.2, a.z));
        view.actor(m, observe, true);
      } else view.actor(m);
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
    nearest = spots.find((s) => B.Vector3.Distance(s.at, foot) <= 2.8);
    hint.textContent = nearest ? labels[nearest.key] : 'WASD 이동 · 중앙과 양쪽 홀에서 디스코 춤';
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
    const seconds = (Date.now() + offset - epoch) / 1000,
      beat = Math.sin(seconds * Math.PI * 4);
    animateBall(seconds);
    for (const m of models.values()) {
      if (dances.has(m.actor.action)) {
        animateDance(m, m.actor.action, (Date.now() + offset - epoch) / 1000);
        continue;
      }
      m.near.position.x = 0;
      const dance = m.actor.action === 'disco',
        right = Math.floor(seconds * 2) % 4 < 2;
      m.near.position.set(dance ? 0.12 * beat : 0, dance ? 0.07 * Math.abs(beat) : 0, 0);
      m.torso.rotation.z = dance ? 0.18 * beat : 0;
      m.limbs.forEach((joint, i) => {
        const sign = i < 2 ? -1 : 1,
          arm = i % 2 === 0;
        joint.rotation.z = arm
          ? sign * (dance ? (sign > 0 === right ? 2.42 + 0.2 * beat : 0.48) : 0.12)
          : 0;
        joint.rotation.x = dance ? (arm ? -0.25 : sign * 0.38 * beat) : 0;
      });
    }
  });
}
