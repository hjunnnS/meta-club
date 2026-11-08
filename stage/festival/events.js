// Durations belong to the button preview, not to a purchased item.
export const effects = {
  led: { label: 'LED 전광판', seconds: 15 },
  crystal: { label: '크리스털 홀로그램', seconds: 14 },
  laser: { label: '레이저 쇼', seconds: 16 },
  phoenix: { label: '불사조 소환', seconds: 14 },
};

export function ledScreen(B, scene, message, nickname = '') {
  const texture = new B.DynamicTexture('stage message', { width: 1024, height: 384 }, scene, false);
  const ctx = texture.getContext();
  const gradient = ctx.createLinearGradient(0, 0, 1024, 384);
  gradient.addColorStop(0, '#171039');
  gradient.addColorStop(1, '#371634');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 384);
  ctx.strokeStyle = '#ea94df';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 16, 988, 352);
  ctx.textAlign = 'center';
  ctx.font = Array.from(message).length <= 14 ? 'bold 86px sans-serif' : 'bold 48px sans-serif';
  const lines = [''];
  for (const character of message) {
    if (ctx.measureText(lines.at(-1) + character).width > 930) lines.push(character);
    else lines[lines.length - 1] += character;
  }
  const spacing = Math.min(80, 235 / lines.length);
  ctx.fillStyle = '#ffdef5';
  lines.forEach((line, i) => ctx.fillText(line, 512, (nickname ? 170 : 210) + (i - (lines.length - 1) / 2) * spacing));
  if (nickname) {
    ctx.font = 'bold 35px sans-serif';
    ctx.fillStyle = '#80f1ee';
    ctx.fillText(nickname, 512, 331, 930);
  }
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

function crystal(B, scene, root) {
  const gem = new B.TransformNode('floating crystal', scene);
  gem.parent = root;
  const vertices = [0, 2.45, 0, 0, -2.15, 0];
  const indices = [];
  const colors = [];
  const palette = ['#98ffff', '#55cde8', '#9472fa', '#3e65d8', '#69e1df', '#848af9'];
  // Flat triangular facets keep their distinct colors as the crystal turns.
  const positions = [];
  for (let i = 0; i < 6; i++) {
    const arc = i * Math.PI / 3;
    vertices.push(1.33 * Math.cos(arc), 0.4, 1.33 * Math.sin(arc));
  }
  for (let i = 0; i < 6; i++) {
    const a = i + 2, b = (i + 1) % 6 + 2;
    for (const [tip, face] of [[0, [0, b, a]], [1, [1, a, b]]]) {
      const color = B.Color3.FromHexString(palette[i]).scale(tip ? 0.68 : 1);
      for (const v of face) {
        indices.push(positions.length / 3);
        positions.push(...vertices.slice(v * 3, v * 3 + 3));
        colors.push(color.r, color.g, color.b, 1);
      }
    }
  }
  const body = attach(new B.Mesh('cut crystal', scene), gem, paint(B, scene, 'opal', '#ffffff', 0.36));
  const geometry = new B.VertexData();
  geometry.positions = positions;
  geometry.indices = indices;
  geometry.colors = colors;
  geometry.normals = [];
  B.VertexData.ComputeNormals(positions, indices, geometry.normals);
  geometry.applyToMesh(body);
  body.enableEdgesRendering();
  body.edgesWidth = 2.2;
  body.edgesColor = new B.Color4(0.6, 1, 1, 1);
  const halo = paint(B, scene, 'cyan projection', '#64f6fa');
  const rings = [3.8, 4.4].map(diameter => {
    const ring = attach(B.MeshBuilder.CreateTorus('projected ring', { diameter, thickness: 0.045, tessellation: 64 }, scene), root, halo);
    ring.position.set(0, 0.1, -7);
    return ring;
  });
  return t => {
    gem.position.set(0, 4.1 + Math.sin(t * 1.6) * 0.27, -7);
    gem.rotation.y = t * 0.85;
    gem.rotation.z = Math.sin(t * 0.8) * 0.13;
    rings.forEach((r, i) => r.scaling.setAll(1 + 0.08 * Math.sin(t * 2.3 + i * 2)));
  };
}

function lasers(B, scene, root) {
  const colors = ['#32e9ef', '#ed46cc', '#9773ff'];
  const paints = colors.map(color => paint(B, scene, 'laser', color, 1));
  const beams = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const beam = attach(B.MeshBuilder.CreateCylinder('sweeping beam', {
        height: 1, diameterTop: 0.12, diameterBottom: 0.035, tessellation: 6,
      }, scene), root, paints[i % 3]);
      beams.push({ beam, side, i, origin: new B.Vector3(side * 6.8, 4.6, -16) });
    }
  }
  return t => {
    const phase = Math.floor(t / 4);
    for (const { beam, side, i, origin } of beams) {
      const spread = (i - 2.5) / 2.5;
      const x = (phase % 2 ? -side : side) * 4 + spread * 9 + Math.sin(t * 1.3) * 4;
      const end = new B.Vector3(x, 4.4 + 2.5 * Math.sin(t * 1.15 + spread * 1.4), 0.5 + 1.5 * Math.cos(t + i));
      const delta = end.subtract(origin);
      beam.position.copyFrom(origin).addInPlace(delta.scale(0.5));
      beam.scaling.y = delta.length();
      beam.rotationQuaternion = B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, delta.normalize(), beam.rotationQuaternion || new B.Quaternion());
      beam.material = paints[(i + phase) % paints.length];
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

export function eventPlayer(B, scene, now = Date.now) {
  let current, root, animate;
  function stop() {
    root?.dispose(false, true);
    root = current = animate = null;
  }
  function set(event) {
    if (!event) { stop(); return; }
    if (current?.id === event.id || now() >= event.start + effects[event.kind].seconds*1000) return;
    stop();
    current = event;
    root = new B.TransformNode('stage event', scene);
    if (event.kind === 'led') ledScreen(B, scene, event.message, event.nickname).parent = root;
    else animate = {crystal, laser:lasers, phoenix}[event.kind](B, scene, root);
    tick();
  }
  function tick() {
    if (!current) return;
    const t = Math.max(0, (now()-current.start)/1000);
    if (t >= effects[current.kind].seconds) stop();
    else animate?.(t);
  }
  scene.onBeforeRenderObservable.add(tick);
  return {set, stop};
}
