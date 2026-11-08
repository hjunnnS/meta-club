// Scenic layer for 05d-4.v1. No scenery participates in the floor/wall collision predicates.
export function dressDisco(B, scene, { placements }) {
  const v = (x, y, z) => new B.Vector3(x, y, z),
    rgb = (s) => B.Color3.FromHexString(s),
    tau = 2 * Math.PI;
  const materials = new Map(),
    groups = new Map();
  function finish(hex, glow = 0) {
    const key = hex + '/' + glow;
    if (!materials.has(key)) {
      const m = new B.StandardMaterial('disco finish ' + key, scene);
      m.diffuseColor = rgb(hex);
      m.emissiveColor = rgb(hex).scale(glow);
      m.specularColor = rgb('#796674');
      m.specularPower = 64;
      materials.set(key, m);
    }
    return materials.get(key);
  }
  function part(shape, at, scale, mat, rotation = B.Quaternion.Identity()) {
    const key = shape + mat.name;
    if (!groups.has(key)) {
      const dims = { diameter: 1, height: 1, tessellation: 16 };
      const mesh =
        shape === 'box'
          ? B.MeshBuilder.CreateBox('decor/' + key, { size: 1 }, scene)
          : B.MeshBuilder.CreateCylinder('decor/' + key, dims, scene);
      mesh.material = mat;
      mesh.isPickable = false;
      groups.set(key, { mesh, data: [] });
    }
    groups.get(key).data.push(...B.Matrix.Compose(scale, rotation, at).asArray());
  }
  const box = (x, y, z, w, h, d, m) => part('box', v(x, y, z), v(w, h, d), m);
  function rail(a, b, d, mat) {
    const axis = b.subtract(a),
      r = B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, axis.normalizeToNew(), new B.Quaternion());
    part('tube', B.Vector3.Center(a, b), v(d, axis.length(), d), mat, r);
  }
  function ribbon(name, points, r, mat) {
    const mesh = B.MeshBuilder.CreateTube(
      'decor/' + name,
      { path: points, radius: r, tessellation: 8 },
      scene,
    );
    mesh.isPickable = false;
    mesh.material = mat;
  }
  const ink = finish('#231828'),
    wine = finish('#6d2948'),
    bourbon = finish('#ad7347'),
    brass = finish('#dda875', 0.16),
    pearl = finish('#ffd9ae', 0.86),
    pink = finish('#fe439e', 1.05),
    aqua = finish('#6fd4db', 0.85),
    amber = finish('#ff984c', 1.0);
  const art = (name, width, height, paint) => {
    const t = new B.DynamicTexture(name, { width, height }, scene, true);
    paint(t.getContext(), width, height);
    t.update();
    t.anisotropicFilteringLevel = 8;
    return t;
  };
  // The same UV orientation is used on all front-facing panels.
  function placard(name, x, y, z, w, h, angle, tex, emit = 0.48) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseTexture = tex;
    m.emissiveTexture = tex;
    m.emissiveColor = B.Color3.White().scale(emit);
    m.specularColor = B.Color3.Black();
    m.backFaceCulling = false;
    tex.uScale = -1;
    tex.uOffset = 1;
    const plane = B.MeshBuilder.CreatePlane('decor/' + name, { width: w, height: h }, scene);
    plane.material = m;
    plane.position.set(x, y, z);
    plane.rotation.y = angle;
    plane.isPickable = false;
  }
  const upholstery = art('channel stitched velvet', 256, 256, (g, w, h) => {
    const fabric = g.createLinearGradient(0, 0, w, h);
    fabric.addColorStop(0, '#c78f9e');
    fabric.addColorStop(0.52, '#ead1cc');
    fabric.addColorStop(1, '#ab778a');
    g.fillStyle = fabric;
    g.fillRect(0, 0, w, h);
    for (let i = -2; i <= 4; i++)
      for (const sign of [-1, 1]) {
        g.beginPath();
        g.moveTo(i * 128, 0);
        g.lineTo(i * 128 + sign * 256, 256);
        g.strokeStyle = '#864f68';
        g.lineWidth = 5;
        g.stroke();
        g.translate(2, 0);
        g.strokeStyle = '#e2bdc5';
        g.lineWidth = 1;
        g.stroke();
        g.translate(-2, 0);
      }
    for (let y = 0; y <= 256; y += 64)
      for (let x = ((y / 64) % 2) * 64; x <= 256; x += 128) {
        g.fillStyle = '#855669';
        g.beginPath();
        g.arc(x, y, 4.4, 0, tau);
        g.fill();
      }
  });
  upholstery.wrapU = upholstery.wrapV = B.Texture.WRAP_ADDRESSMODE;
  for (const mesh of scene.meshes) {
    if (mesh.material?.name !== 'velvet') continue;
    const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind),
      normals = mesh.getVerticesData(B.VertexBuffer.NormalKind),
      uv = [];
    for (let i = 0; i < positions.length; i += 3)
      uv.push(
        (Math.abs(normals[i]) > 0.65 ? positions[i + 2] : positions[i]) / 1.65,
        positions[i + 1] / 1.65,
      );
    mesh.setVerticesData(B.VertexBuffer.UVKind, uv);
    mesh.material.albedoTexture = upholstery;
  }
  // Ceiling cloth faces down so the overhead map still reads as a cutaway.
  for (const [x, y, z, w, d] of [
    [0, 7.67, -1.9, 14.2, 28.3],
    [-12, 5.66, 0.4, 8.4, 23.6],
    [12, 5.66, 0.4, 8.4, 23.6],
  ]) {
    const ceiling = B.MeshBuilder.CreateGround(
      'decor/coffer ceiling',
      { width: w, height: d },
      scene,
    );
    ceiling.rotation.x = Math.PI;
    ceiling.position.set(x, y, z);
    ceiling.material = finish('#271d32');
    ceiling.isPickable = false;
    for (let n = -2; n <= 2; n++) {
      const rib = x + (n * w) / 5;
      box(rib, y - 0.06, z, 0.065, 0.08, d - 0.3, bourbon);
      for (let i = 0; i < 12; i++) {
        const depth = z - d * 0.47 + i * d * 0.085;
        box(rib + 0.27, y - 0.14, depth, 0.042, 0.026, 0.042, pearl);
      }
    }
  }
  // Split the archived floor into its original glass tiles; the pools of light are inside the grid.
  for (const [name, [cx, , cz], pitch, rows] of [
    ['hall', placements.mainDance, 1.48, 12],
    ['A', placements.danceA, 1.07, 9],
    ['B', placements.danceB, 1.07, 9],
  ]) {
    const palette =
      name === 'hall'
        ? ['#ed438a', '#df7550', '#ffba79', '#985bb7', '#fa7198']
        : name === 'A'
          ? ['#7634ac', '#c946b0', '#ef86c6']
          : ['#f48445', '#d74b46', '#f6bb68'];
    const tiles = scene.meshes.filter(
      (m) => m.name === 'trim/tile ' + name || m.name.startsWith('trim/tile ' + name + '_'),
    );
    tiles.forEach((mesh, index) => {
      const base = rgb(palette[index % palette.length]);
      const mat = new B.ShaderMaterial(
        'milk glass ' + name + index,
        scene,
        {
          vertexSource:
            'precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec2 p;void main(){p=position.xz;gl_Position=worldViewProjection*vec4(position,1.);}',
          fragmentSource: `precision highp float;varying vec2 p;uniform vec2 origin;uniform float pitch;uniform vec3 tint;
        void main(){vec2 q=(p-origin)/pitch,edge=abs(fract(q)-.5)*2.;float dist=max(edge.x,edge.y);
        float parity=fract(sin(dot(floor(q),vec2(13.1,7.3)))*4783.3);
        vec3 c=mix(tint,vec3(1.,.88,.84),(.2+.20*parity)*(1.-dist*dist));
        gl_FragColor=vec4(c*(.76+.22*parity)*(1.-.32*smoothstep(.78,.98,dist)),1.);}`,
        },
        { attributes: ['position'], uniforms: ['worldViewProjection', 'origin', 'pitch', 'tint'] },
      );
      const zCenter = name === 'hall' ? cz - 0.2 : cz + 0.6;
      mat.setVector2(
        'origin',
        new B.Vector2(cx - (name === 'hall' ? 4 : 3) * pitch, zCenter - (rows * pitch) / 2),
      );
      mat.setFloat('pitch', pitch);
      mat.setColor3('tint', base);
      mesh.material = mat;
    });
  }
  // Balcony-height pelmets and three concentric Art Deco crowns leave the floor and sightline open.
  for (const [cx, cy, cz, rx, rz, accent] of [
    [0, 7.12, 0, 5.7, 8.8, pink],
    [-12, 5.1, -3.5, 3.55, 5.9, aqua],
    [12, 5.1, -3.5, 3.55, 5.9, amber],
  ]) {
    for (let k = 0; k < 3; k++) {
      const path = [];
      for (let j = 0; j <= 72; j++) {
        const a = (j * tau) / 72;
        path.push(
          v(cx + (rx - k * 0.26) * Math.cos(a), cy - k * 0.15, cz + (rz - k * 0.38) * Math.sin(a)),
        );
      }
      ribbon('ceiling crown', path, k === 0 ? 0.115 : 0.048, k === 1 ? brass : accent);
    }
    for (let i = 0; i < 16; i++) {
      const a = (tau * i) / 16,
        x = cx + rx * Math.cos(a),
        z = cz + rz * Math.sin(a);
      part('tube', v(x, cy - 0.18, z), v(0.31, 0.35, 0.31), ink);
      part('tube', v(x, cy - 0.37, z), v(0.21, 0.03, 0.21), pearl);
    }
  }
  for (const side of [-1, 1]) {
    const accent = side === -1 ? aqua : amber;
    // Build the fly tower and perimeter upholstery outside the reviewed wall footprints.
    box(side * 16.08, 2.55, 0.4, 0.22, 5.1, 23.5, wine);
    box(side * 12, 2.5, -11.15, 8, 5, 0.28, ink);
    box(side * 12, 1.7, 12.1, 8, 3.4, 0.21, wine);
    for (let i = 0; i <= 22; i++) {
      const z = -10.55 + i * 0.99;
      part('tube', v(side * 15.98, 2.69, z), v(0.24, 4.68, 0.32), i % 3 === 0 ? bourbon : wine);
    }
    for (const h of [0.64, 1.65, 4.65]) {
      box(side * 15.81, h, 0.45, 0.08, 0.055, 22.6, h === 4.65 ? accent : brass);
      box(side * 12, h, -10.89, 7.8, 0.055, 0.08, h === 4.65 ? accent : brass);
    }
    for (const z of [-4, 2, 8.5]) {
      for (const off of [-1, 1]) {
        const edge = z + off * (z === -4 ? 1.96 : 1.45);
        box(side * 7.3, 1.51, edge, 0.15, 2.98, 0.12, bourbon);
        box(side * 7.22, 1.55, edge, 0.055, 2.82, 0.04, accent);
      }
      box(side * 7.3, 3.12, z, 0.28, 0.22, z === -4 ? 4.35 : 3.3, ink);
      box(side * 7.24, 3.16, z, 0.12, 0.055, z === -4 ? 4.25 : 3.15, accent);
    }
  }
  // Original record-sleeve artwork. Each room has its own label colour and pressing.
  function record(label, sub, colour) {
    return art(label, 768, 768, (g, w, h) => {
      g.fillStyle = '#241526';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 35; i++) {
        g.strokeStyle = i % 3 === 0 ? colour : '#69344f';
        g.lineWidth = 2;
        g.strokeRect(12 + i * 6, 12 + i * 6, w - 24 - i * 12, h - 24 - i * 12);
      }
      g.save();
      g.translate(w / 2, h / 2);
      const shine = g.createConicGradient(0.12, 0, 0);
      for (const [stop, color] of [
        [0, '#201a29'],
        [0.15, '#514660'],
        [0.22, '#c8adad'],
        [0.26, '#44364b'],
        [0.49, '#191720'],
        [0.68, '#71616e'],
        [0.74, '#b0a4ac'],
        [0.82, '#3b3044'],
        [1, '#201a29'],
      ])
        shine.addColorStop(stop, color);
      g.fillStyle = shine;
      g.beginPath();
      g.arc(0, 0, 300, 0, tau);
      g.fill();
      for (let r = 110; r < 297; r += 4) {
        g.strokeStyle = r % 12 === 2 ? '#d7bfd561' : '#211b29ac';
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(0, 0, r, 0, tau);
        g.stroke();
      }
      g.fillStyle = colour;
      g.beginPath();
      g.arc(0, 0, 107, 0, tau);
      g.fill();
      g.fillStyle = '#251827';
      g.textAlign = 'center';
      g.font = 'bold 35px Georgia';
      g.fillText(label, 0, -19, 180);
      g.font = 'bold 15px sans-serif';
      g.fillText(sub, 0, 53, 165);
      g.beginPath();
      g.arc(0, 0, 8, 0, tau);
      g.fill();
      g.restore();
    });
  }
  for (const [side, label, sub, hex] of [
    [-1, 'SIDE A', 'AFTER HOURS', '#7be2da'],
    [1, 'SIDE B', 'GOLD EDITION', '#ffbc72'],
  ]) {
    const cx = 12 * side,
      accent = side === -1 ? aqua : amber;
    placard(label, cx, 2.7, -10.6, 3.9, 3.9, Math.PI, record(label, sub, hex));
    const sideArt = record(side < 0 ? 'SOUL' : 'FUNK', '33⅓ RPM', hex);
    placard(label + ' sleeve', side * 15.67, 2.9, -5, 3.0, 3.0, (side * Math.PI) / 2, sideArt);
    for (const offset of [-3.25, 3.25]) {
      for (let j = 0; j < 4; j++)
        box(
          cx + offset + j * 0.105,
          2.48,
          -10.67,
          0.045,
          3.4 - j * 0.46,
          0.04,
          j % 2 ? brass : accent,
        );
    }
  }
  // Layered scallop shell and fluted shoulders frame the DJ end wall.
  box(0, 3.75, -16.19, 14.3, 7.5, 0.32, ink);
  for (let j = 0; j < 63; j++) {
    const x = -6.85 + j * 0.22;
    part('tube', v(x, 3.65, -15.97), v(0.25, 7.15, 0.25), j % 3 ? wine : finish('#883b65'));
  }
  for (let k = 0; k < 5; k++) {
    const pts = [];
    const radius = 5.35 - k * 0.53;
    for (let j = 0; j <= 40; j++) {
      const a = (Math.PI * j) / 40;
      pts.push(v(radius * Math.cos(a), 0.98 + radius * Math.sin(a), -15.22 - k * 0.04));
    }
    ribbon('stage shell', pts, k % 2 ? 0.065 : 0.085, k % 2 ? brass : pink);
  }
  for (let j = 1; j < 16; j++) {
    const a = (Math.PI * j) / 16;
    rail(
      v(0.78 * Math.cos(a), 1.02 + 0.78 * Math.sin(a), -15.33),
      v(3.19 * Math.cos(a), 1.02 + 3.19 * Math.sin(a), -15.33),
      0.049,
      brass,
    );
  }
  const marq = art('disco marquee', 1024, 256, (g, w, h) => {
    g.fillStyle = '#281629';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ea98a1';
    g.lineWidth = 5;
    g.strokeRect(10, 11, w - 20, h - 22);
    g.textAlign = 'center';
    g.fillStyle = '#efbd90';
    g.font = 'bold 26px sans-serif';
    g.fillText('S T E R E O     •     D A N C E   H A L L', w / 2, 57);
    g.font = 'italic bold 145px Georgia';
    g.fillStyle = '#ffe1bc';
    g.fillText('Discothèque', w / 2, 199, 910);
  });
  placard('DJ marquee', 0, 6.22, -15.05, 6.7, 1.68, Math.PI, marq, 0.75);
  // Console relief and speaker arrays remain on the stage wall, clear of its centre anchor.
  box(0, 0.58, -15.61, 4.5, 1.16, 0.25, ink);
  box(0, 1.18, -15.58, 4.64, 0.09, 0.36, brass);
  for (let j = 0; j < 22; j++)
    box(-2.12 + j * 0.202, 0.58, -15.47, 0.07, 0.94, 0.05, j % 2 ? bourbon : wine);
  for (const side of [-1, 1]) {
    for (const h of [1.15, 2.35]) {
      box(6.17 * side, h, -15.38, 1.0, 1.1, 0.29, ink);
      const rot = B.Quaternion.RotationAxis(B.Axis.X, Math.PI / 2);
      part('tube', v(6.17 * side, h, -15.16), v(0.74, 0.13, 0.74), brass, rot);
      part('tube', v(6.17 * side, h, -15.07), v(0.63, 0.11, 0.63), ink, rot);
    }
    // Framed velvet bays read as separate lounge and bar spaces from the entrance.
    const x = side * 12;
    const badge = art(side + ' sign', 640, 160, (g, w, h) => {
      g.fillStyle = '#32212e';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#edb77e';
      g.lineWidth = 4;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#ffe2b6';
      g.textAlign = 'center';
      g.font = 'italic bold 78px Georgia';
      g.fillText(side < 0 ? 'Lounge' : 'Bar', w / 2, 104);
    });
    placard('venue ' + side, x, 2.2, 11.77, 3.3, 0.83, 0, badge);
  }
  // Recessed lounge and back bar sit beyond the front parapets.
  for (const side of [-1, 1]) {
    const x = 12 * side;
    box(x, 2.18, 12.55, 7.8, 4.36, 0.2, wine);
    for (const h of [1.2, 2.66, 3.6]) {
      box(x, h, 12.24, 7.45, 0.12, 0.52, ink);
      box(x, h - 0.05, 11.99, 7.38, 0.035, 0.04, side > 0 ? amber : pink);
    }
    if (side > 0) {
      for (let i = 0; i < 15; i++) {
        const bx = x - 3.3 + i * 0.46;
        const glass = [finish('#368a83'), finish('#984050'), finish('#ba873e')][i % 3];
        const h = 0.38 + (i % 4) * 0.08;
        part('tube', v(bx, 2.73 + h / 2, 12.18), v(0.18, h, 0.18), glass);
        part('tube', v(bx, 2.76 + h, 12.18), v(0.083, 0.17, 0.083), brass);
      }
    } else {
      for (let i = 0; i < 7; i++)
        box(x - 3.15 + i * 1.05, 1.36, 12.15, 0.96, 0.46, 0.24, finish('#9b4862'));
    }
  }
  for (const { mesh, data } of groups.values())
    mesh.thinInstanceSetBuffer('matrix', new Float32Array(data), 16, true);
  const bloom = new B.GlowLayer('neon diffusion', scene, { blurKernelSize: 36 });
  bloom.intensity = 0.42;
  for (const mesh of scene.meshes)
    if ([pearl, pink, aqua, amber].includes(mesh.material)) bloom.addIncludedOnlyMesh(mesh);
  scene.clearColor = new B.Color4(0.051, 0.023, 0.075, 1);
  scene.getLightByName('sky').diffuse = rgb('#cbadc9');
  scene.getLightByName('sun').diffuse = rgb('#f6c4a8');
  for (const [x, y, z, tint, intensity] of [
    [0, 3.6, -13, '#ff4f9f', 14],
    [-12, 3.1, -7, '#80ceec', 7],
    [12, 3.1, -7, '#ff9859', 8],
    [-7, 2, 7, '#e46aa9', 4],
    [7, 2, 7, '#efa35d', 4],
  ]) {
    const l = new B.PointLight('decor/room wash', v(x, y, z), scene);
    l.diffuse = rgb(tint);
    l.intensity = intensity;
    l.range = 10;
  }
  for (const m of scene.materials) if ('maxSimultaneousLights' in m) m.maxSimultaneousLights = 8;
}
