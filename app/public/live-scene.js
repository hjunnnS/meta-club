import { permittedPath } from './edm-layout.js';
import { dances, danceCamera, animateDance } from './free-dance.js';
import { avatarFactory } from './avatar.js';
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
  const viewDance = danceCamera(B, scene);
  let own,
    mode = 'auto',
    low = false,
    lastSent = 0,
    tally = 0,
    frames = 0,
    moveBefore = null,
    activeSeat = null;
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
  function onSnapshot({ actors, self, zones }) {
    if (zones) states = zones;
    dancers = actors.filter((a) => a.action === 'dance' || dances.has(a.action)).length;
    own = self;
    const remaining = new Set(models.keys());
    for (const a of actors) {
      if (a.id === self) {
        if (!dances.has(a.action)) {
          if (scene.activeCamera?.name === 'free dance') scene.activeCamera = cam;
          continue;
        }
        if (!preview) viewDance(a);
      }
      let model = models.get(a.id);
      if (!model) {
        model = make(a);
        models.set(a.id, model);
      }
      model.actor = a;
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
      scene.activeCamera = cam;
      preview.camera.dispose();
      preview.screen.dispose();
      preview.material.dispose();
      preview.texture.dispose();
      preview = null;
    }
    if (!data) return;
    const texture = new B.DynamicTexture(
      'LED preview text',
      { width: 1024, height: 384 },
      scene,
      false,
    );
    const ctx = texture.getContext();
    ctx.fillStyle = '#20132b';
    ctx.fillRect(0, 0, 1024, 384);
    ctx.font =
      Array.from(data.message).length <= 14 ? 'bold 68px sans-serif' : 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffbcea';
    const lines = [''];
    for (const char of data.message) {
      const last = lines.length - 1;
      if (ctx.measureText(lines[last] + char).width > 940) lines.push(char);
      else lines[last] += char;
    }
    lines.forEach((line, i) => ctx.fillText(line, 512, 207 + (i - (lines.length - 1) / 2) * 58));
    texture.update();
    const material = new B.StandardMaterial('LED preview', scene);
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const screen = B.MeshBuilder.CreatePlane(
      'local LED preview',
      { width: 12.8, height: 5.3 },
      scene,
    );
    screen.position.set(0, 5.5, -17.9);
    screen.material = material;
    screen.isPickable = false;
    const camera = new B.FreeCamera('LED preview camera', new B.Vector3(0, 4.8, -6), scene);
    camera.setTarget(screen.position);
    scene.activeCamera = camera;
    preview = { screen, camera, material, texture };
  }
  window.addEventListener('message', (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const { kind, data } = e.data || {};
    if (kind === 'clock') {
      epoch = data.epoch;
      offset = data.offset;
    }
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
    // The 120 BPM test loop and all clients share the room epoch. Smooth washes
    // follow a four-beat phrase; the floor strips and dancers keep the same phase.
    const phase = t * Math.PI * 4,
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
    for (const m of models.values()) {
      const a = m.actor,
        target = new B.Vector3(a.x, a.y, a.z);
      m.root.position = B.Vector3.Lerp(m.root.position, target, Math.min(1, dt / 90));
      m.root.rotation.y = a.yaw;
      const close =
        B.Vector3.DistanceSquared(scene.activeCamera.position, target) < (low ? 8 : 21) ** 2;
      m.near.setEnabled(close);
      m.far.setEnabled(!close);
      if (a.ai) {
        ai++;
        if ((close ? m.torso : m.far).isInFrustum(planes)) visibleAI++;
      }
      if (dances.has(a.action)) {
        if (close) {
          animateDance(m, a.action, t);
          detailed++;
        } else {
          const sway = Math.sin(phase / 2);
          m.far.position.x = a.action === 'side-step' ? 0.28 * sway : 0;
          m.far.position.y = 0.79 + (a.action === 'groove' ? 0.14 : 0.06) * Math.abs(beatWave);
          m.far.rotation.z = (a.action === 'disco-point' ? 0.24 : 0.1) * sway;
        }
        continue;
      }
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
    if (own && now - lastSent > 100 && activeSeat === null) {
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
  return (from, to) => permittedPath(from, to, states);
}
