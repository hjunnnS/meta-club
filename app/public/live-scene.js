import { rhythmFloor } from './rhythm-floor.js';
import { playlistPosition, trackBeat } from './music.js';
import { eventPlayer, ledScreen, houseScreen, houseLights } from '/stage/festival/events.js';
import { permittedPath } from './edm-layout.js';
import { dances, danceCamera, animateDance } from './free-dance.js';
import { avatarFactory, playerView } from './avatar.js';
export function startLiveScene({
  B,
  cam,
  scene,
  engine,
  canvas,
  glow,
  eyeHeight,
  joystick,
  place,
}) {
  const send = (kind, data) => parent.postMessage({ kind, data }, location.origin);
  const models = new Map(),
    make = avatarFactory(B, scene, glow);
  let epoch = Date.now(),
    offset = 0;
  const renderFloor = rhythmFloor(B, scene);
  const renderHouseLights = houseLights(B, scene);
  const ambient = scene.getLightByName('ambient');
  if (ambient) ambient.intensity = 0.52;
  let tracks = [];
  let fastFlash = false, otherWands = true;
  const updateBoard = houseScreen(B, scene);
  const stageEvents = eventPlayer(B, scene, () => Date.now() + offset, () => fastFlash);
  const view = playerView(B, scene, cam, canvas, eyeHeight, document.body, { followDistance: 7.1, followLift: 0.47, followFov: 1.23 });
  const viewDance = danceCamera(B, scene);
  let own,
    mode = 'auto',
    low = false,
    lastSent = 0,
    tally = 0,
    frames = 0,
    moveBefore = null,
    activeSeat = null, riding = false;
  function quality(value) {
    low = value;
    glow.isEnabled = !low;
    engine.setHardwareScalingLevel(low ? 1.5 : 1);
  }
  let states = ['CLOSED', 'CLOSED'],
    dancers = 0;
  const washes = scene.lights
    .filter((l) => l.name.startsWith('Stage wash'))
    .map((light) => ({ light, base: light.intensity }));
  const strips = scene.materials
    .filter((m) => ['Orchid LED', 'Ice LED', 'Rose LED'].includes(m.name))
    .map((material) => ({ material, base: material.emissiveColor.clone() }));
  function onSnapshot({ actors, self, zones, stageEvent }) {
    stageEvents.set(stageEvent);
    if (zones) states = zones;
    dancers = actors.filter((a) => a.action === 'dance' || dances.has(a.action)).length;
    own = self;
    const remaining = new Set(models.keys());
    for (const a of actors) {
      let model = models.get(a.id);
      if (!model) {
        model = make(a);
        models.set(a.id, model);
      }
      model.actor = a;
      if (a.id === self) {
        riding = a.trainSlot > 0;
        if (riding) place(a);
        const activity = a.trainSlot == null && dances.has(a.action) ? viewDance(a) : null;
        view.actor(model, activity, a.seat != null);
      }
      remaining.delete(a.id);
    }
    for (const id of remaining) {
      models.get(id).dispose();
      models.delete(id);
    }
  }
  let preview;
  function showPreview(data) {
    if (preview) {
      view.preview(null);
      preview.camera.dispose();
      preview.screen.dispose(false, true);
      preview = null;
    }
    if (!data) return;
    const screen = ledScreen(B, scene, data.message);
    const camera = new B.FreeCamera('LED preview camera', new B.Vector3(0, 4.8, -6), scene);
    camera.setTarget(screen.position);
    view.preview(camera);
    preview = { screen, camera };
  }
  window.addEventListener('message', (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const { kind, data } = e.data || {};
    if (kind === 'clock') {
      epoch = data.epoch;
      tracks = data.tracks || [];
      offset = data.offset;
    }
    if (kind === 'other-wands') otherWands = data;
    if (kind === 'fast-flash') fastFlash = data === true;
    if (kind === 'led-preview') showPreview(data);
    if (kind === 'actors') onSnapshot(data);
    if (kind === 'place') {
      activeSeat = data.seat;
      place(data);
      moveBefore = null;
    }
    if (kind === 'quality') {
      mode = data;
      if (mode !== 'auto') quality(mode === 'low');
    }
    if (kind === 'resume') {
      engine.resize();
      joystick(0, 0);
    }
  });
  const pad = document.createElement('button');
  pad.textContent = '이동';
  pad.ariaLabel = '이동 조이스틱';
  pad.style.cssText =
    'position:fixed;bottom:15px;left:15px;width:74px;height:74px;border:1px solid #ddd8;border-radius:50%;background:#21172ab8;touch-action:none;color:white;';
  pad.hidden = !matchMedia('(any-pointer: coarse)').matches;
  document.body.append(pad);
  let padId = null,
    lookId = null,
    lastX = 0,
    lastY = 0;
  function stick(e) {
    const r = pad.getBoundingClientRect();
    joystick(
      Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 30)),
      Math.max(-1, Math.min(1, (r.top + r.height / 2 - e.clientY) / 30)),
    );
  }
  pad.onpointerdown = (e) => {
    if (padId !== null) return;
    padId = e.pointerId;
    pad.setPointerCapture(padId);
    stick(e);
  };
  pad.onpointermove = (e) => {
    if (e.pointerId === padId) stick(e);
  };
  pad.onlostpointercapture = () => {
    padId = null;
    joystick(0, 0);
  };
  canvas.onpointerdown = (e) => {
    if (lookId !== null) return;
    canvas.focus();
    lookId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(lookId);
  };
  canvas.onpointermove = (e) => {
    if (e.pointerId !== lookId) return;
    cam.rotation.y -= (e.clientX - lastX) * 0.003;
    cam.rotation.x = Math.max(-1.35, Math.min(1.35, cam.rotation.x + (e.clientY - lastY) * 0.003));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  canvas.onlostpointercapture = () => {
    lookId = null;
  };
  window.addEventListener('blur', () => joystick(0, 0));
  window.addEventListener('resize', () => engine.resize());
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now(),
      dt = engine.getDeltaTime(),
      t = (Date.now() + offset - epoch) / 1000;
    // The track beat and all clients share the room epoch. Smooth washes
    // follow a four-beat phrase; the floor strips and dancers keep the same phase.
    const playback = playlistPosition(tracks, epoch, Date.now() + offset);
    const beats = trackBeat(playback, t);
    const celebrating = stageEvents.kind === 'led';
    renderHouseLights(beats, !stageEvents.kind);
    renderFloor(beats, celebrating);
    updateBoard(playback?.track.title || '음악 대기 중', beats, !preview && !celebrating);
    const phase = beats * Math.PI * 2,
      beatWave = Math.sin(phase);
    washes.forEach(({ light, base }, i) => {
      light.intensity = base * (dancers ? 1 + 0.38 * Math.sin(phase / 4 + (i * Math.PI) / 2) : 1);
    });
    strips.forEach(({ material, base }, i) => {
      base.scaleToRef(dancers ? 1 + 0.26 * Math.sin(phase / 4 + i * 2) : 1, material.emissiveColor);
    });
    let detailed = 0,
      ai = 0,
      visibleAI = 0;
    const planes = B.Frustum.GetPlanes(scene.getTransformMatrix());
    const ownSlot = models.get(own)?.actor.trainSlot;
    for (const m of models.values()) {
      const a = m.actor,
        target = new B.Vector3(a.x, a.y, a.z);
      if (a.id !== own || a.seat != null) {
        m.root.position = B.Vector3.Lerp(m.root.position, target, Math.min(1, dt / 90));
        m.root.rotation.y = a.yaw;
      }
      const adjacentRider = ownSlot != null && a.trainSlot != null && Math.abs(a.trainSlot - ownSlot) <= 1;
      const detailRadius = low ? (adjacentRider ? 12 : 8) : 21;
      const close = a.id === own || B.Vector3.DistanceSquared(scene.activeCamera.position, target) < detailRadius ** 2;
      m.near.setEnabled(close);
      m.far.setEnabled(!close);
      m.showWand(Boolean(a.wand && (a.id === own || otherWands)), close);
      if (a.ai) {
        ai++;
        if ((close ? m.torso : m.far).isInFrustum(planes)) visibleAI++;
      }
      const dance = a.action === 'dance' ? 'groove' : a.action;
      if (dances.has(dance)) {
        if (close) {
          animateDance(m, dance, beats);
          detailed++;
        } else {
          const sway = Math.sin(phase / 2);
          m.far.position.x = a.action === 'side-step' ? 0.28 * sway : 0;
          m.far.position.y = 0.79 + (a.action === 'groove' ? 0.14 : 0.06) * Math.abs(beatWave);
          m.far.rotation.z = (a.action === 'disco-point' ? 0.24 : 0.1) * sway;
        }
        continue;
      }
      m.near.rotation.setAll(0);
      m.near.position.x = 0;
      m.far.position.x = 0;
      const beat = a.action === 'dance' ? beatWave : Math.sin(t * (a.action === 'walk' ? 8 : 6));
      if (!close) {
        m.far.position.y = a.action === 'sit' ? 0.47 : 0.79;
        m.far.rotation.z = a.action === 'dance' || a.action === 'wave' ? 0.12 * beat : 0;
        continue;
      }
      detailed++;
      m.near.position.y =
        a.action === 'sit' ? -0.32 : a.action === 'dance' ? 0.07 * Math.abs(beat) : 0;
      m.torso.rotation.z = a.action === 'dance' ? 0.18 * beat : 0;
      m.limbs.forEach((j, i) => {
        const sign = i < 2 ? -1 : 1,
          arm = i % 2 === 0;
        j.rotation.x =
          a.action === 'walk'
            ? (arm ? -1 : 1) * sign * 0.55 * beat
            : a.action === 'sit' && !arm
              ? -1.1
              : 0;
        j.rotation.z = arm
          ? a.action === 'wave' && sign > 0
            ? 2.5 + 0.22 * beat
            : a.action === 'dance'
              ? sign * (0.75 + 0.65 * beat)
              : sign * 0.12
          : 0;
      });
    }
    if (own && now - lastSent > 100 && activeSeat === null && !riding) {
      const pos = {
        x: cam.position.x,
        y: cam.position.y - eyeHeight,
        z: cam.position.z,
        yaw: cam.rotation.y,
      };
      const moved =
        !moveBefore || Object.keys(pos).some((k) => Math.abs(pos[k] - moveBefore[k]) > 0.002);
      if (moved || now - lastSent > 950) {
        send('move', pos);
        lastSent = now;
        moveBefore = pos;
      }
    }
    frames++;
    tally += dt;
    if (tally > 2000) {
      const ms = tally / frames;
      if (mode === 'auto' && ((ms > 28 && !low) || (ms < 16 && low))) quality(!low);
      send('render-info', { ai, detailed, visibleAI, ms, quality: low ? 'low' : 'high' });
      tally = 0;
      frames = 0;
    }
  });
  send('scene-ready', true);
  let lastGateNotice = -Infinity;
  return (from, to) => {
    const allowed = permittedPath(from, to, states);
    if (!allowed && performance.now() - lastGateNotice > 4000) {
      send('gate-notice', '아직 열리지 않은 구역입니다. 중앙 플로어에서 입구 방향으로 걸으면 바와 라운지로 나갈 수 있습니다.');
      lastGateNotice = performance.now();
    }
    return allowed;
  };
}
