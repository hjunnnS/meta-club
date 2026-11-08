// Durations belong to the button preview, not to a purchased item.
export const effects = {
  led: { label: 'LED 전광판', seconds: 15 },
  laser: { label: '레이저 쇼', seconds: 16 },
  phoenix: { label: '불사조 소환', seconds: 14 },
};

function lettering(message, nickname) {
  const layer = document.createElement('canvas');
  layer.width = 1024;
  layer.height = 384;
  const ctx = layer.getContext('2d');
  ctx.shadowColor = '#050622';
  ctx.shadowBlur = 8;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#10142c';
  ctx.lineWidth = 8;
  ctx.textAlign = 'center';
  ctx.font = Array.from(message).length <= 14 ? 'bold 86px sans-serif' : 'bold 48px sans-serif';
  const lines = [''];
  for (const character of message) {
    if (ctx.measureText(lines.at(-1) + character).width > 930) lines.push(character);
    else lines[lines.length - 1] += character;
  }
  const spacing = Math.min(80, 235 / lines.length);
  ctx.fillStyle = '#ffdef5';
  lines.forEach((line, i) => {
    const y = (nickname ? 170 : 210) + (i - (lines.length - 1) / 2) * spacing;
    ctx.strokeText(line, 512, y);
    ctx.fillText(line, 512, y);
  });
  if (nickname) {
    ctx.font = 'bold 35px sans-serif';
    ctx.fillStyle = '#80f1ee';
    ctx.strokeText(nickname, 512, 331, 930);
    ctx.fillText(nickname, 512, 331, 930);
  }
  return layer;
}

// Original moving artwork. Keep the lettering on a separate layer above the media wall.
function mediaWall(ctx, t) {
  const wash = ctx.createLinearGradient(0, 0, 1024, 384);
  wash.addColorStop(0, '#122b68');
  wash.addColorStop(0.53, '#090f30');
  wash.addColorStop(1, '#174858');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1024, 384);
  for (let ribbon = 0; ribbon < 16; ribbon++) {
    ctx.beginPath();
    for (let x = -16; x <= 1040; x += 16) {
      const y = 175 + ribbon * 5 + 78 * Math.sin(x / 181 - t * 0.94 + ribbon * 0.12)
        + 44 * Math.sin(x / 89 + t * 0.51 + ribbon * 0.07);
      if (x === -16) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = ribbon % 4 === 0 ? 3.4 : 1.5;
    ctx.strokeStyle = ribbon < 8 ? '#467ddb' : '#419daa';
    ctx.stroke();
  }
  for (let i = 0; i < 68; i++) {
    const x = (i * 103 + t * (12 + i % 5 * 9)) % 1170 - 92;
    const y = (i * 71 + t * (7 + i % 4)) % 520 - 108;
    const width = 12 + i * 17 % 73, height = 20 + i * 23 % 102;
    ctx.strokeStyle = ['#226097', '#24aab2', '#68e1d0', '#669df5'][i % 4];
    ctx.lineWidth = i % 6 === 0 ? 3 : 1.4;
    ctx.strokeRect(x, y, width, height);
  }
}

export function ledScreen(B, scene, message, nickname = '', overlay = lettering(message, nickname)) {
  const texture = new B.DynamicTexture('stage message', { width: 1024, height: 384 }, scene, false);
  const ctx = texture.getContext();
  mediaWall(ctx, 0);
  ctx.drawImage(overlay, 0, 0);
  texture.update();
  const material = new B.StandardMaterial('LED message', scene);
  material.emissiveTexture = texture;
  material.disableLighting = true;
  material.backFaceCulling = false;
  const screen = B.MeshBuilder.CreatePlane('LED message', { width: 12.8, height: 5.3 }, scene);
  screen.position.set(0, 5.5, -17.90);
  screen.material = material;
  screen.isPickable = false;
  return screen;
}

export function houseScreen(B, scene) {
  let title, overlay, lastFrame = -1;
  const screen = ledScreen(B, scene, 'EDM CLUB');
  screen.name = 'EDM house screen';
  const texture = screen.material.emissiveTexture;
  const ctx = texture.getContext();
  return (track, beats, visible) => {
    screen.setEnabled(visible);
    if (!visible) return;
    const frame = Math.floor(beats * 3);
    if (title !== track) {
      title = track;
      overlay = lettering('EDM CLUB', track);
    } else if (lastFrame === frame) return;
    lastFrame = frame;
    mediaWall(ctx, beats * 0.36);
    ctx.drawImage(overlay, 0, 0);
    texture.update();
  };
}

function paint(B, scene, name, hex, intensity = 0.7) {
  const material = new B.StandardMaterial(name, scene);
  material.diffuseColor = B.Color3.FromHexString(hex);
  material.emissiveColor = material.diffuseColor.scale(intensity);
  material.backFaceCulling = false;
  return material;
}

function attach(mesh, parent, material) {
  mesh.parent = parent;
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

function marquee(B, scene, root, event, fastFlash) {
  const overlay = lettering(event.message, event.nickname);
  const screen = ledScreen(B, scene, event.message, event.nickname, overlay);
  screen.parent = root;
  const texture = screen.material.emissiveTexture;
  const ctx = texture.getContext();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastFrame = -1;
  return t => {
    const frame = Math.floor(Math.round(t * 1000) / 50);
    if (frame === lastFrame) return;
    lastFrame = frame;
    mediaWall(ctx, t);
    const sweep = (t % 3.5) / 2.6 * 1360 - 170;
    const shine = ctx.createLinearGradient(sweep - 75, 0, sweep + 75, 45);
    shine.addColorStop(0, 'transparent');
    shine.addColorStop(0.5, 'rgba(197,245,255,0.30)');
    shine.addColorStop(1, 'transparent');
    ctx.fillStyle = shine;
    ctx.fillRect(21, 19, 982, 346);
    for (let i = 0; i < 29; i++) {
      const wave = (1 + Math.cos(i * 0.5 - t * 4)) / 2;
      ctx.fillStyle = 'rgba(255,218,158,' + (0.18 + 0.8 * wave ** 3) + ')';
      const x = 30 + i * 34.4;
      ctx.fillRect(x, 24, 15, 7);
      ctx.fillRect(1009 - x, 353, 15, 7);
    }
    // A small four-point glint travels along each edge without obscuring the lettering.
    for (const [x, y] of [[sweep, 29], [1024 - sweep, 356]]) {
      if (x < 23 || x > 1001) continue;
      ctx.fillStyle = '#fff3d5';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r = i % 2 ? 3 : 16;
        ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fill();
    }
    // 20 Hz gives each 100 ms shutter state two texture frames.
    const cycle = frame % 100;
    const blinking = (cycle >= 20 && cycle < 40) || cycle >= 80;
    const offFrames = fastFlash() ? 2 : 5;
    if (reducedMotion.matches || !blinking || Math.floor(cycle / offFrames) % 2 === 1)
      ctx.drawImage(overlay, 0, 0);
    texture.update();
  };
}

function laserBlackouts(start) {
  // The show start seeds one shared sequence, including for spectators who join mid-show.
  let seed = start >>> 0;
  function between(min, max) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return min + (max - min) * seed / 4294967296;
  }
  const cuts = [];
  let at = between(0.55, 1.25);
  while (at < effects.laser.seconds) {
    const end = at + between(0.13, 0.34);
    cuts.push([at, end]);
    if (between(0, 1) < 0.45) {
      const second = end + between(0.29, 0.54);
      at = second + between(0.13, 0.22);
      cuts.push([second, at]);
    } else {
      at = end;
    }
    at += between(0.62, 1.8);
  }
  return cuts;
}

function lasers(B, scene, root, event, fastFlash) {
  const cuts = laserBlackouts(event.start);
  const lime = '#cfff3c', violet = '#bc3aff', amber = '#ffae1e';
  const spectrum = ['#30ecff', '#fe309b', '#4673ff', '#6bff56', '#ffd540', '#ff4141'];
  const palette = Object.fromEntries([...spectrum, lime, violet, amber].map(hex => [hex, B.Color3.FromHexString(hex)]));
  const gradient = new B.DynamicTexture('spotlight falloff', 64, scene, false);
  const ctx = gradient.getContext();
  const pool = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  pool.addColorStop(0, '#ffffff');
  pool.addColorStop(0.35, '#aaaaaa');
  pool.addColorStop(1, '#000000');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, 64, 64);
  gradient.getAlphaFromRGB = true;
  gradient.update();

  function beam(name, top, bottom, material) {
    const mesh = attach(B.MeshBuilder.CreateCylinder(name, {
      height: 1, diameterTop: top, diameterBottom: bottom, tessellation: 10,
      cap: B.Mesh.NO_CAP,
    }, scene), root, material);
    mesh.rotationQuaternion = new B.Quaternion();
    return mesh;
  }
  const direction = new B.Vector3();
  function aim(mesh, origin, target) {
    target.subtractToRef(origin, direction);
    mesh.position.copyFrom(origin).addInPlace(direction.scale(0.5));
    mesh.scaling.y = direction.length();
    B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, direction.normalize(), mesh.rotationQuaternion);
  }

  // Eight overhead heads on a circular truss project shafts and matching pools on the floor.
  const heads = Array.from({ length: 8 }, (_, i) => {
    const angle = Math.PI * i / 4;
    const origin = new B.Vector3(4.6 * Math.cos(angle), 7.65, -8 + 3.3 * Math.sin(angle));
    const light = paint(B, scene, 'shaft glow', '#ffffff');
    light.disableLighting = true;
    light.alphaMode = B.Engine.ALPHA_ADD;
    light.alpha = 0.15;
    const core = paint(B, scene, 'beam core', '#ffffff');
    core.disableLighting = true;
    const shaft = beam('overhead shaft', 0.75, 0.10, light);
    const ray = beam('overhead core', 0.13, 0.05, core);
    const lens = attach(B.MeshBuilder.CreateSphere('moving head lens', {diameter: 0.28, segments: 8}, scene), root, core);
    lens.position.copyFrom(origin);
    const footprint = paint(B, scene, 'floor wash', '#ffffff');
    footprint.disableLighting = true;
    footprint.opacityTexture = gradient;
    footprint.emissiveTexture = gradient;
    footprint.alphaMode = B.Engine.ALPHA_ADD;
    footprint.alpha = 0.52;
    const spot = attach(B.MeshBuilder.CreateGround('floor pool', {width: 2.8, height: 2.8}, scene), root, footprint);
    return {angle, origin, shaft, ray, light, core, spot, footprint};
  });
  const fanMaterials = spectrum.map(hex => paint(B, scene, 'scanner beam', hex));
  const fans = Array.from({length: 28}, (_, i) => {
    const side = i < 14 ? -1 : 1;
    return {
      side, spread: (i % 14) / 13 * 2 - 1,
      origin: new B.Vector3(side * 6.7, 4.2, -15.6),
      mesh: beam('scanning fan', 0.065, 0.018, fanMaterials[i % spectrum.length]),
    };
  });
  const target = new B.Vector3();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  return t => {
    const ms = Math.round(t * 1000);
    const cycleMs = ms % 3000;
    const rapidCue = fastFlash() && ms >= 3000 && cycleMs < 1000;
    const blackout = rapidCue ? Math.floor(cycleMs / 100) % 2 === 1
      : cuts.some(([start, end]) => t >= start && t < end);
    const lightsOn = reducedMotion.matches || !blackout;
    root.setEnabled(lightsOn);
    if (!lightsOn) return;
    const phase = Math.floor(t / 4);
    for (const [i, head] of heads.entries()) {
      const a = head.angle + t * 0.72;
      const color = palette[phase === 0 ? (i % 2 ? lime : violet)
        : phase === 2 ? amber : spectrum[(i + phase) % spectrum.length]];
      for (const mat of [head.core, head.light, head.footprint]) mat.emissiveColor.copyFrom(color);
      if (phase === 2) {
        target.set(head.origin.x + 2.6 * Math.sin(t * 1.8), 0.08, head.origin.z + 3.3);
      } else {
        const radius = phase === 0 ? 5.7 : 7.3 + 1.6 * Math.sin(t * 1.5);
        target.set(radius * Math.cos(a), 0.08, -6 + radius * Math.sin(a));
      }
      // Alternate sides across the audience, then wash the rear wall above the entrance.
      const side = i % 2 ? 1 : -1;
      if (phase === 1) target.set(side * (14.6 + 2.7 * Math.sin(a)), 4.06, -13.8 + 3.7 * Math.cos(a));
      if (phase === 3) target.set(side * (10 + 8 * Math.sin(a)), 2.8, 18 + 5 * Math.cos(a));
      aim(head.shaft, head.origin, target);
      aim(head.ray, head.origin, target);
      head.spot.position.set(target.x, phase === 1 ? 4.05 : 0.08, target.z);
    }
    for (const {mesh, origin, side, spread} of fans) {
      mesh.setEnabled(phase === 1 || phase === 3);
      if (!mesh.isEnabled()) continue;
      if (phase === 1) {
        target.set(-side * 12 + spread * 8, 3.8 + 1.7 * spread * side + Math.sin(t * 1.8), 20 + spread * 3);
      } else {
        const angle = t * 1.15 + spread * 1.5;
        target.set(-side * 14 + 6 * Math.cos(angle), 4.8 + 1.8 * Math.sin(angle) * side, 9 + 12 * Math.cos(angle * 0.6));
      }
      aim(mesh, origin, target);
    }
  };
}

// Original faceted phoenix: paired articulated wings, tapered flight feathers and a forked tail.
function phoenix(B, scene, root) {
  const bird = new B.TransformNode('phoenix flight', scene);
  bird.parent = root;
  const gold = paint(B, scene, 'sun gold', '#ffbd42', 0.78);
  const fire = paint(B, scene, 'vermillion', '#e3331b', 0.46);
  const rose = paint(B, scene, 'ember', '#b91e50', 0.42);
  const pearl = paint(B, scene, 'ivory flame', '#fff0b0', 0.84);
  const V = (x,y,z) => new B.Vector3(x,y,z);
  function oval(name, pos, size, mat) {
    const mesh = attach(B.MeshBuilder.CreateSphere(name, {segments: 8, diameter: 1}, scene), bird, mat);
    mesh.position.copyFrom(pos);
    mesh.scaling.copyFrom(size);
    return mesh;
  }
  function plume(parent, start, end, width, material) {
    const mesh = attach(new B.Mesh('tapered feather', scene), parent, material);
    const middle = B.Vector3.Lerp(start, end, 0.36);
    const side = B.Vector3.Cross(end.subtract(start), B.Axis.Y).normalize().scale(width);
    const points = [start, middle.add(side), end, middle.subtract(side), middle.add(V(0, width * 0.7, 0))];
    const data = new B.VertexData();
    data.positions = points.flatMap(p => p.asArray());
    data.indices = [0,1,4, 1,2,4, 2,3,4, 3,0,4, 0,3,2, 2,1,0];
    data.normals = [];
    B.VertexData.ComputeNormals(data.positions, data.indices, data.normals);
    data.applyToMesh(mesh);
  }
  oval('breast', V(0,0,0), V(1.05,1.15,2.5), fire);
  oval('neck', V(0,0.42,0.9), V(0.64,1.18,0.76), gold);
  oval('head', V(0,0.94,1.14), V(0.82,0.77,0.92), gold);
  plume(bird, V(0,0.95,1.47), V(0,0.78,2.05), 0.21, pearl);
  for (const sign of [-1,1]) {
    oval('eye', V(sign*0.31,1.04,1.4), V(0.13,0.13,0.13), pearl);
    plume(bird, V(sign*0.15,1.15,1.03), V(sign*0.38,1.94,0.38), 0.16, fire);
  }
  const wings = [-1,1].map(sign => {
    const wing = new B.TransformNode('wing', scene);
    wing.parent = bird;
    wing.position.x = sign*0.3;
    plume(wing, V(0,0,0.5), V(sign*3.35,0.56,0.24), 0.68, gold);
    for (let i=0;i<7;i++) {
      const u=i/6;
      plume(wing, V(sign*(0.3+1.95*u),0.18+0.32*u,0.36),
        V(sign*(1.25+3.55*u),0.05+0.7*u,-2.85+2.35*u),0.42-0.16*u,[rose,fire,gold][i%3]);
    }
    return {wing, sign};
  });
  for(let i=-2;i<=2;i++)
    plume(bird,V(i*0.09,-0.05,-0.65),V(i*0.66,-0.62,-4.65+Math.abs(i)*0.65),0.29,[gold,fire,rose,fire,gold][i+2]);
  return t => {
    const u = t / effects.phoenix.seconds;
    bird.scaling.setAll(1.48 * Math.max(0.01, Math.min(1, t/1.2, (1-u)*9)));
    bird.position.set(3.5*Math.sin(2*Math.PI*u),4.2+1.4*Math.sin(Math.PI*u),-10+4*Math.sin(Math.PI*u));
    bird.rotation.y = 0.7*Math.cos(2*Math.PI*u);
    bird.rotation.z = -0.12*Math.sin(2*Math.PI*u);
    for (const {wing,sign} of wings) wing.rotation.z = sign*(0.18+0.5*Math.sin(t*3.7));
  };
}

export function eventPlayer(B, scene, now = Date.now, fastFlash = () => false) {
  let current, root, animate;
  function stop() {
    root?.dispose(false, true);
    root = current = animate = null;
  }
  function set(event) {
    if (!event || !Object.hasOwn(effects, event.kind)) { stop(); return; }
    if (current?.id === event.id || now() >= event.start + effects[event.kind].seconds*1000) return;
    stop();
    current = event;
    root = new B.TransformNode('stage event', scene);
    animate = {led: marquee, laser: lasers, phoenix}[event.kind](B, scene, root, event, fastFlash);
    tick();
  }
  function tick() {
    if (!current) return;
    const t = Math.max(0, (now()-current.start)/1000);
    if (t >= effects[current.kind].seconds) stop();
    else animate?.(t);
  }
  scene.onBeforeRenderObservable.add(tick);
  return {set, stop, get kind() { return current?.kind; }};
}
