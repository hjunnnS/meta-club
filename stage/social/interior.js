// All scenery is separate from the GLB ground, barriers, and interactive furniture.
import { socialTables } from './tables.js';

export function dressGarden(B, scene, extras) {
  const V = (x, y, z) => new B.Vector3(x, y, z),
    tau = Math.PI * 2;
  let seed = 21074;
  function rand() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function texture(name, w, h, draw) {
    const t = new B.DynamicTexture(name, { width: w, height: h }, scene, true);
    draw(t.getContext(), w, h);
    t.update();
    return t;
  }
  const horizon = texture('waterfront at dusk', 4096, 768, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#101e42');
    grad.addColorStop(0.45, '#354c79');
    grad.addColorStop(0.72, '#997996');
    grad.addColorStop(0.91, '#efb79d');
    grad.addColorStop(1, '#796b88');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 460; i++) {
      g.fillStyle = 'rgba(235,239,255,' + (0.12 + rand() * 0.5) + ')';
      g.fillRect(rand() * w, rand() * h * 0.65, 1.4, 1.4);
    }
    // Three layers keep the waterfront silhouette legible from every side.
    for (let row = 0; row < 3; row++) {
      let x = -30;
      while (x < w) {
        const width = 10 + rand() * 48,
          height = 18 + rand() * (row === 1 ? 97 : 56) + 16 * Math.sin(x * 0.007);
        const base = h - 11 + row * 3,
          top = base - height;
        g.fillStyle = ['#827b93', '#565c78', '#343e5b'][row];
        g.fillRect(x, top, width, height);
        if (rand() < 0.22) {
          g.fillRect(x + width * 0.2, top - 6, width * 0.6, 7);
          g.fillRect(x + width * 0.53, top - 17, 1.5, 18);
        }
        for (let wy = top + 5; wy < base - 2; wy += 6)
          for (let wx = x + 3; wx < x + width - 2; wx += 6)
            if (rand() < 0.37) {
              g.fillStyle = rand() > 0.48 ? '#ecbc92' : '#9bbad2';
              g.fillRect(wx, wy, 2.5, 2);
            }
        x += width + rand() * 5;
      }
    }
    g.fillStyle = '#293f53';
    g.fillRect(0, h - 5, w, 5);
  });
  horizon.wrapU = B.Texture.WRAP_ADDRESSMODE;
  const vertexSource =
    'precision highp float;attribute vec3 position;uniform mat4 world,worldViewProjection;varying vec3 pos;void main(){pos=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}';
  function environment(name, mesh, body) {
    const fragmentSource =
      'precision highp float;varying vec3 pos;uniform sampler2D panorama;uniform vec3 eye;void main(){vec3 ray=normalize(pos-eye);float u=atan(ray.z,ray.x)/6.2831853+.5;' +
      body +
      '}';
    const mat = new B.ShaderMaterial(
      name,
      scene,
      { vertexSource, fragmentSource },
      {
        attributes: ['position'],
        uniforms: ['world', 'worldViewProjection', 'eye'],
        samplers: ['panorama'],
      },
    );
    mat.setTexture('panorama', horizon);
    mat.backFaceCulling = false;
    mat.onBindObservable.add(() => mat.setVector3('eye', scene.activeCamera.globalPosition));
    mesh.material = mat;
    mesh.isPickable = false;
  }
  const sky = B.MeshBuilder.CreateSphere('garden/dusk', { diameter: 500, segments: 18 }, scene);
  environment(
    'evening sky',
    sky,
    'gl_FragColor=texture2D(panorama,vec2(u,clamp(.013+ray.y*2.1,.003,.998)));',
  );
  const water = B.MeshBuilder.CreateGround('garden/water', { width: 340, height: 340 }, scene);
  water.position.y = -1.63;
  environment(
    'quiet harbour',
    water,
    `
    float r=sin(pos.z*7.8+sin(pos.x*2.7))*.55+sin(pos.x*5.1+pos.z*10.2)*.45;
    vec3 reflection=texture2D(panorama,vec2(u+.002*r,clamp(-ray.y*.39+.018+r*.012,.004,.9))).rgb;
    float glint=smoothstep(.79,1.,r)*.035;
    gl_FragColor=vec4(mix(vec3(.075,.236,.265),reflection,.25)+glint*vec3(.54,.72,.75),1.);`,
  );

  const masonry = texture('limestone pavers', 512, 512, (g, w, h) => {
    g.fillStyle = '#b5a795';
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 4; col++) {
        const n = Math.floor(rand() * 18);
        g.fillStyle = 'rgb(' + (210 + n) + ',' + (195 + n) + ',' + (174 + n) + ')';
        g.fillRect((col + (row % 2) * 0.5) * 128 + 1, row * 64 + 1, 126, 62);
      }
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = rand() > 0.5 ? '#fff5da42' : '#776c602b';
      g.fillRect(rand() * w, rand() * h, 1.5, 1);
    }
  });
  const timber = texture('teak deck', 512, 512, (g, w, h) => {
    for (let row = 0; row < 16; row++) {
      const n = Math.floor(rand() * 22);
      g.fillStyle = 'rgb(' + (156 + n) + ',' + (108 + n) + ',' + (72 + n) + ')';
      g.fillRect(0, row * 32, w, 32);
      g.fillStyle = '#5b443f';
      g.fillRect(0, row * 32, w, 2);
      g.fillRect((row % 3) * 164, row * 32, 2, 32);
      for (let j = 0; j < 30; j++) {
        g.fillStyle = '#f2cd9c25';
        g.fillRect(rand() * w, row * 32 + rand() * 30, rand() * 72, 1);
      }
    }
  });
  for (const t of [masonry, timber]) {
    t.wrapU = t.wrapV = B.Texture.WRAP_ADDRESSMODE;
    t.anisotropicFilteringLevel = 8;
  }
  for (const mesh of scene.meshes) {
    if (!mesh.name.startsWith('floor/')) continue;
    const mat = mesh.material,
      p = mesh.getVerticesData(B.VertexBuffer.PositionKind);
    if (!p || !mat) continue;
    const uv = [];
    for (let i = 0; i < p.length; i += 3) uv.push(p[i] / 3.3, p[i + 2] / 3.3);
    mesh.setVerticesData(B.VertexBuffer.UVKind, uv);
    mat.albedoTexture = ['timber', 'plank'].includes(mat.name) ? timber : masonry;
    mat.albedoColor = B.Color3.FromHexString(mat.name === 'sage' ? '#a8b88b' : '#eee1c9');
  }
  // Thin instances group flower clusters, leaves and lamps into a handful of draw calls.
  const batches = new Map();
  function piece(shape, tint, at, size, rotation = B.Quaternion.Identity(), emission = 0) {
    const key = shape + tint + emission;
    if (!batches.has(key)) {
      const name = 'garden/' + key;
      const mesh =
        shape === 'bud'
          ? B.MeshBuilder.CreateIcoSphere(name, { radius: 1, subdivisions: 2, flat: false }, scene)
          : shape === 'pole'
            ? B.MeshBuilder.CreateCylinder(
                name,
                { diameter: 1, height: 1, tessellation: 10 },
                scene,
              )
            : B.MeshBuilder.CreateBox(name, { size: 1 }, scene);
      const m = new B.StandardMaterial(name, scene);
      m.diffuseColor = B.Color3.FromHexString(tint);
      m.emissiveColor = m.diffuseColor.scale(emission);
      m.specularColor = new B.Color3(0.09, 0.08, 0.09);
      mesh.material = m;
      mesh.isPickable = false;
      batches.set(key, { mesh, matrices: [] });
    }
    batches.get(key).matrices.push(...B.Matrix.Compose(size, rotation, at).asArray());
  }
  function twig(a, b, diam, tint, emission = 0) {
    const d = b.subtract(a),
      rot = B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, d.normalizeToNew(), new B.Quaternion());
    piece('pole', tint, B.Vector3.Center(a, b), V(diam, d.length(), diam), rot, emission);
  }
  const polar = (c, r, a, h = 0) => V(c[0] + r * Math.cos(a), c[1] + h, c[2] + r * Math.sin(a));
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const greens = ['#325a48', '#406f51', '#588359', '#769362'];
  const pinks = ['#c96989', '#df82a1', '#ef9fb2', '#f7bec6', '#efd0d1'];
  // Replace only the placeholder petals; retain the reviewed tree planter and trunk.
  for (const mesh of scene.meshes) if (mesh.name === 'trim/blossoms') mesh.setEnabled(false);
  for (let limb = 0; limb < 19; limb++) {
    const a = limb * 2.39996,
      r = 1.4 + rand() * 1.55;
    const outer = polar([0, 0, 1], r, a, 3.3 + rand() * 1.5);
    const fork = V(outer.x * 0.46, 2.82 + rand() * 0.58, 1 + (outer.z - 1) * 0.46);
    twig(V(0, 1.65, 1), fork, 0.16, '#745951');
    twig(fork, outer, 0.095, '#78554c');
    for (let k = 0; k < 7; k++) {
      const v = outer.add(V((rand() - 0.5) * 1.6, (rand() - 0.5) * 0.8, (rand() - 0.5) * 1.6));
      twig(outer, v, 0.038, '#886457');
      piece('bud', pick(pinks), v, V(0.49, 0.36, 0.49));
      for (let j = 0; j < 12; j++) {
        const angle = rand() * tau,
          h = rand() * 2 - 1,
          rr = Math.sqrt(1 - h * h);
        piece(
          'bud',
          pick(pinks),
          v.add(V(0.46 * rr * Math.cos(angle), 0.35 * h, 0.46 * rr * Math.sin(angle))),
          V(0.13, 0.109, 0.14),
        );
      }
    }
  }
  function lantern(base, height) {
    const p = base.add(V(0, height, 0));
    twig(base, p, 0.052, '#735c49');
    piece('pole', '#776346', p, V(0.24, 0.08, 0.24));
    piece('pole', '#ffd398', p.add(V(0, 0.13, 0)), V(0.18, 0.22, 0.18), undefined, 1.15);
    piece('pole', '#806247', p.add(V(0, 0.28, 0)), V(0.27, 0.07, 0.27));
  }
  const tables = socialTables(extras);
  const gateways = Object.values(extras.gateways).flat();
  function awayFromPassage(p) {
    return gateways.every(([x, , z]) => Math.hypot(p.x - x, p.z - z) > 2);
  }
  function clearOfSeats(p) {
    return tables.every((t) =>
      [...t.seats, { x: t.center[0], z: t.center[2] }].every(
        (s) => Math.hypot(p.x - s.x, p.z - s.z) > 1.25,
      ),
    );
  }
  for (const [id, { center, radius }] of Object.entries(extras.zones)) {
    // Low planted banks and stone foundations join each platform to the water.
    const baseY = -1.7,
      foundationTop = center[1] - 0.42;
    piece(
      'pole',
      '#86766b',
      V(center[0], (baseY + foundationTop) / 2, center[2]),
      V(radius * 1.93, foundationTop - baseY, radius * 1.93),
    );
    for (let k = 0; k < 72; k++) {
      const a = (k * tau) / 72,
        extent = 0.45 + 0.38 * Math.sin(3 * a + radius) + 0.26 * Math.sin(7 * a);
      const bank = polar(center, radius + extent, a, -center[1] - 1.43);
      piece(
        'bud',
        pick(['#74786d', '#87897a', '#657468']),
        bank,
        V(0.62 + rand() * 0.44, 0.39 + rand() * 0.27, 0.68 + rand() * 0.4),
      );
      for (let j = 0; j < 4; j++) {
        const p = bank.add(V((rand() - 0.5) * 0.9, 0.34 + rand() * 0.26, (rand() - 0.5) * 0.9));
        piece('bud', pick(greens), p, V(0.32, 0.26 + rand() * 0.27, 0.35));
      }
      if (k % 2 === 0) {
        const p = polar(center, radius - 0.12, a, -0.17),
          q = polar(center, radius - 0.12, a + (tau / 72) * 1.9, -0.17);
        twig(p, q, 0.035, '#efb87d', 0.62);
      }
    }
    const garden = id === 'garden' || id === 'vip';
    for (let i = 0; i < 64; i++) {
      const a = (i * tau) / 64,
        p = polar(center, radius - 0.37, a, 0.43);
      if (!awayFromPassage(p)) continue;
      // All planting is confined to the narrow parapet strip.
      for (let k = 0; k < (garden ? 8 : 4); k++) {
        const at = p.add(V((rand() - 0.5) * 0.45, 0.08 + rand() * 0.27, (rand() - 0.5) * 0.42));
        const angle = rand() * tau;
        piece(
          'bud',
          pick(greens),
          at,
          V(0.11, 0.2 + rand() * 0.16, 0.095),
          B.Quaternion.RotationYawPitchRoll(angle, 0.55, 0),
        );
        if (k % 3 === 0)
          piece(
            'bud',
            id === 'garden'
              ? pick(['#bba9d3', '#a68cc1', '#f1d8ea'])
              : pick(['#ffcda3', '#e9e6ba']),
            at.add(V(0, 0.17, 0)),
            V(0.08, 0.12, 0.08),
          );
      }
      if (i % 9 === 0) lantern(p, 0.4);
    }
    if (['roof', 'vip', 'booths'].includes(id)) {
      // Trace the outside rear arc with an open, slatted canopy.
      const lo = id === 'roof' ? Math.PI * 1.17 : 0,
        hi = id === 'roof' ? Math.PI * 1.84 : 1.52;
      for (let i = 0; i <= 16; i++) {
        const a = lo + ((hi - lo) * i) / 16,
          p = polar(center, radius - 0.28, a);
        const top = p.add(V(0, 3.18, 0)),
          inner = polar(center, radius - 1.46, a, 3.04);
        twig(inner, top, 0.095, '#9e7651');
        if (i < 16)
          for (const r of [radius - 0.28, radius - 1.46])
            twig(
              polar(center, r, a, 3.1),
              polar(center, r, a + (hi - lo) / 16, 3.1),
              0.115,
              '#8c684d',
            );
        if (i % 4 === 0 && awayFromPassage(p) && clearOfSeats(p)) {
          twig(p, top, 0.115, '#826345');
          lantern(p, 0.74);
        }
        for (let j = 0; j < 3; j++)
          piece(
            'bud',
            pick(greens),
            top.add(V((rand() - 0.5) * 0.48, -0.15 * rand(), (rand() - 0.5) * 0.48)),
            V(0.25, 0.15, 0.26),
          );
        if (i % 3 === 1)
          piece('bud', '#ffe4b9', inner.add(V(0, -0.16, 0)), V(0.1, 0.16, 0.1), undefined, 1.1);
      }
    }
  }
  // Palms just outside the deck perimeter frame the seated views without occupying a path.
  function palm(x, z, height, lean) {
    const base = V(x, -1.54, z),
      foot = V(x, -0.5, z);
    piece('bud', '#657569', base, V(1.15, 1.04, 1.05));
    let last = foot;
    for (let i = 1; i <= 8; i++) {
      const f = i / 8,
        pt = V(x + lean * f * f, -0.5 + height * f, z + 0.28 * f * f);
      twig(last, pt, 0.31 - 0.105 * f, '#8a7761');
      piece('pole', '#665a50', pt, V(0.3 - 0.1 * f, 0.036, 0.3 - 0.1 * f));
      last = pt;
    }
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39996,
        dir = V(Math.cos(a), 0, Math.sin(a)),
        cross = V(-dir.z, 0, dir.x),
        len = 2.25 + rand() * 0.78;
      let prev = last;
      for (let j = 1; j <= 7; j++) {
        const f = j / 7,
          pt = last.add(dir.scale(len * f)).add(V(0, 1.12 * Math.sin(Math.PI * f) - 0.52 * f, 0));
        twig(prev, pt, 0.043, '#536e49');
        prev = pt;
        for (const sign of [-1, 1]) {
          const end = pt
            .add(cross.scale(sign * (0.15 + 0.55 * Math.sin(Math.PI * f))))
            .add(dir.scale(0.33))
            .add(V(0, -0.32, 0));
          const d = end.subtract(pt),
            rot = B.Quaternion.FromUnitVectorsToRef(
              B.Axis.Y,
              d.normalizeToNew(),
              new B.Quaternion(),
            );
          piece(
            'bud',
            pick(greens),
            B.Vector3.Center(pt, end),
            V(0.105, d.length() * 0.65, 0.075),
            rot,
          );
        }
      }
    }
  }
  for (const [x, z, h, l] of [
    [-17.6, -4.7, 6.5, 0.6],
    [-17, 0, 5.7, -0.45],
    [17.9, -7.2, 6.4, -0.4],
    [14.4, 12.8, 5.3, 0.5],
    [-13.3, 14.2, 5.4, -0.4],
    [5, -19.4, 7.1, 0.54],
    [-5.8, -19, 6.4, -0.38],
  ])
    palm(x, z, h, l);
  for (const [key, [start, end]] of Object.entries(extras.gateways)) {
    const dx = end[0] - start[0],
      dz = end[2] - start[2],
      l = Math.hypot(dx, dz),
      edge = key === 'entry-main' ? 1.7 : 1.34;
    for (const sign of [-1, 1])
      for (const f of [0.18, 0.82]) {
        const p = V(
          start[0] + f * dx - ((sign * dz) / l) * edge,
          start[1] + f * (end[1] - start[1]),
          start[2] + f * dz + ((sign * dx) / l) * edge,
        );
        lantern(p, 0.77);
      }
  }
  if (location.pathname === '/review/social/index.html') {
    for (const {
      center: [x, y, z],
    } of tables) {
      piece('pole', '#a17f5c', V(x, y + 0.87, z), V(0.2, 0.055, 0.2));
      piece('pole', '#f2cb9a', V(x, y + 0.99, z), V(0.12, 0.21, 0.12), undefined, 0.45);
    }
  }
  for (const { mesh, matrices } of batches.values())
    mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, true);
  const hemi = scene.getLightByName('sky');
  hemi.intensity = 0.82;
  hemi.diffuse = B.Color3.FromHexString('#e7dbed');
  hemi.groundColor = B.Color3.FromHexString('#727992');
  const sun = scene.getLightByName('sun');
  sun.intensity = 0.8;
  sun.diffuse = B.Color3.FromHexString('#ffd6ab');
  for (const [x, y, z, hex, intensity] of [
    [0, 2.5, 1, '#ffaec9', 5],
    [-12, 2, -3, '#ffcf92', 4],
    [0, 5, -14, '#ffcf92', 5],
  ]) {
    const lamp = new B.PointLight('garden uplight', V(x, y, z), scene);
    lamp.diffuse = B.Color3.FromHexString(hex);
    lamp.intensity = intensity;
    lamp.range = 8;
  }
}
