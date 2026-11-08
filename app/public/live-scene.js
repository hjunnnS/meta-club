const colors = { indigo: '#8973F2', teal: '#49C8B1', rose: '#F28BAB', gold: '#FFCC55' };
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
    materials = new Map();
  for (const [name, hex] of Object.entries(colors)) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor.scale(0.25);
    materials.set(name, m);
  }
  const face = new B.StandardMaterial('face', scene);
  face.diffuseColor = new B.Color3(0.87, 0.66, 0.49);
  const leg = new B.StandardMaterial('denim', scene);
  leg.diffuseColor = new B.Color3(0.095, 0.09, 0.15);
  function make(actor) {
    const root = new B.TransformNode(actor.id, scene);
    const near = new B.TransformNode('detail', scene);
    near.parent = root;
    const capsule = (parent, name, radius, height, y, material) => {
      const mesh = B.MeshBuilder.CreateCapsule(
        name,
        { radius, height, tessellation: 8, subdivisions: 1 },
        scene,
      );
      mesh.parent = parent;
      mesh.position.y = y;
      mesh.material = material;
      mesh.isPickable = false;
      return mesh;
    };
    const shirt = materials.get(actor.avatar) || materials.get('indigo');
    const torso = capsule(near, 'torso', 0.23, 0.72, 1.04, shirt);
    capsule(near, 'head', 0.15, 0.32, 1.55, face);
    const limbs = [];
    for (const sign of [-1, 1]) {
      for (const arm of [true, false]) {
        const joint = new B.TransformNode('joint', scene);
        joint.parent = near;
        joint.position.set(sign * (arm ? 0.25 : 0.115), arm ? 1.33 : 0.79, 0);
        capsule(
          joint,
          arm ? 'arm' : 'leg',
          arm ? 0.075 : 0.095,
          arm ? 0.55 : 0.73,
          arm ? -0.25 : -0.34,
          arm ? shirt : leg,
        );
        limbs.push(joint);
      }
    }
    const far = capsule(root, 'distant avatar', 0.22, 1.56, 0.79, shirt);
    far.setEnabled(false);
    const label = B.MeshBuilder.CreatePlane(
      'name',
      { width: 1.55, height: 0.34, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    label.parent = root;
    label.position.y = 1.98;
    label.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    label.isPickable = false;
    const tex = new B.DynamicTexture('name', { width: 512, height: 96 }, scene, false);
    tex.hasAlpha = true;
    tex.drawText(
      actor.nickname.slice(0, 18),
      null,
      66,
      'bold 44px sans-serif',
      actor.ai ? '#ffdb76' : 'white',
      '#251d32',
      true,
    );
    const mat = new B.StandardMaterial('name material', scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = B.Color3.White();
    mat.disableLighting = true;
    label.material = mat;
    root.position.set(actor.x, actor.y, actor.z);
    root.rotation.y = actor.yaw;
    return {
      root,
      near,
      far,
      limbs,
      torso,
      actor,
      label,
      dispose() {
        root.dispose();
        mat.dispose();
        tex.dispose();
      },
    };
  }
  let epoch = Date.now(),
    offset = 0;
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
  function onSnapshot({ actors, self }) {
    own = self;
    const remaining = new Set(models.keys());
    for (const a of actors) {
      if (a.id === self) continue;
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
  window.addEventListener('message', (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const { kind, data } = e.data || {};
    if (kind === 'clock') {
      epoch = data.epoch;
      offset = data.offset;
    }
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
    let detailed = 0,
      ai = 0,
      visibleAI = 0;
    const planes = B.Frustum.GetPlanes(scene.getTransformMatrix());
    for (const m of models.values()) {
      const a = m.actor,
        target = new B.Vector3(a.x, a.y, a.z);
      m.root.position = B.Vector3.Lerp(m.root.position, target, Math.min(1, dt / 90));
      m.root.rotation.y = a.yaw;
      const close = B.Vector3.DistanceSquared(cam.position, target) < (low ? 8 : 17) ** 2;
      m.near.setEnabled(close);
      m.far.setEnabled(!close);
      if (a.ai) {
        ai++;
        if ((close ? m.torso : m.far).isInFrustum(planes)) visibleAI++;
      }
      if (!close) continue;
      detailed++;
      const beat = Math.sin(t * (a.action === 'walk' ? 8 : 6));
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
}
