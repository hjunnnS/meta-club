// Scenery is attached after loading the approved blockout. Only floor/ and wall/
// meshes from that blockout participate in the walker's ground and barrier tests.
export function dressAlley(B, scene) {
  let seed = 3701;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const color = (s) => B.Color3.FromHexString(s);
  function material(name, hex, emission = 0) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = color(hex);
    m.emissiveColor = m.diffuseColor.scale(emission);
    m.specularColor = new B.Color3(0.13, 0.13, 0.16);
    return m;
  }
  function texture(name, w, h, paint) {
    const tex = new B.DynamicTexture(name, { width: w, height: h }, scene, true);
    paint(tex.getContext(), w, h);
    tex.update();
    tex.anisotropicFilteringLevel = 8;
    return tex;
  }
  function box(name, x, y, z, w, h, d, mat) {
    const mesh = B.MeshBuilder.CreateBox('decor/' + name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    return mesh;
  }
  const iron = material('powder coated steel', '#302f3e'),
    brass = material('antique brass', '#a27643');
  const gold = material('tungsten', '#ffb753', 1.8),
    mint = material('turquoise glass', '#57d3ce', 1.35);
  const red = material('vermilion glass', '#ff5a40', 1.4);
  function panel(name, x, y, z, w, h, angle, tex, emit = 0.45) {
    const face = B.MeshBuilder.CreatePlane(
      'decor/' + name,
      { width: w, height: h, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    face.position.set(x, y, z);
    face.rotation.y = angle;
    face.isPickable = false;
    const m = material(name + ' ink', '#ffffff');
    tex.uScale = -1;
    tex.uOffset = 1;
    m.diffuseTexture = tex;
    m.emissiveTexture = tex;
    m.emissiveColor = B.Color3.White().scale(emit);
    m.specularColor = B.Color3.Black();
    face.material = m;
    return face;
  }
  function flecks(g, w, h, n) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = random() > 0.5 ? 'rgba(255,239,212,.14)' : 'rgba(13,12,25,.22)';
      g.fillRect(random() * w, random() * h, 1 + random() * 2, 1);
    }
  }
  // Older mesh materials have no texture coordinates. Use metre-scaled planar
  // projection per face so the brick courses meet at the corners and don't stretch.
  const brick = texture('kiln brick', 512, 512, (g, w, h) => {
    g.fillStyle = '#473d41';
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++)
      for (let col = -1; col < 5; col++) {
        const x = (col + (row % 2) * 0.5) * 128,
          y = (row * h) / 12,
          v = Math.floor(random() * 25);
        g.fillStyle = 'rgb(' + (122 + v) + ',' + (69 + v) + ',' + (58 + v) + ')';
        g.fillRect(x + 2, y + 2, 124, h / 12 - 4);
        g.fillStyle = '#ffffff12';
        g.fillRect(x + 4, y + 3, 119, 2);
      }
    flecks(g, w, h, 11000);
  });
  const asphalt = texture('aggregate', 256, 256, (g, w, h) => {
    g.fillStyle = '#5c585e';
    g.fillRect(0, 0, w, h);
    flecks(g, w, h, 11500);
  });
  for (const t of [brick, asphalt]) {
    t.wrapU = B.Texture.WRAP_ADDRESSMODE;
    t.wrapV = B.Texture.WRAP_ADDRESSMODE;
  }
  for (const mesh of scene.meshes) {
    const m = mesh.material;
    if (!['brick', 'cement', 'asphalt'].includes(m?.name)) continue;
    const p = mesh.getVerticesData(B.VertexBuffer.PositionKind),
      n = mesh.getVerticesData(B.VertexBuffer.NormalKind),
      uv = [];
    if (!p || !n) continue;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(n[i + 1]) > 0.65) uv.push(p[i] / 2.7, p[i + 2] / 2.7);
      else uv.push((Math.abs(n[i]) > 0.65 ? p[i + 2] : p[i]) / 2.7, p[i + 1] / 2.7);
    }
    mesh.setVerticesData(B.VertexBuffer.UVKind, uv);
    m.albedoTexture = m.name === 'brick' ? brick : asphalt;
    m.albedoColor = color(
      m.name === 'brick' ? '#f3cec1' : m.name === 'cement' ? '#b8aeba' : '#857e92',
    );
  }
  // Hand-lettered four-colour piece on the rear retaining wall.
  const mural = texture('backstreet piece', 1536, 384, (g, w, h) => {
    g.fillStyle = '#242235';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 56; i++) {
      const x = random() * w,
        y = random() * h;
      g.fillStyle = ['#1e6871', '#dd743e', '#b13448', '#57376d'][i % 4];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 80 + random() * 160, y - 70);
      g.lineTo(x + 30, y + 20);
      g.fill();
    }
    const letters = [
      [
        [30, 8],
        [165, 0],
        [147, 38],
        [82, 44],
        [75, 67],
        [133, 60],
        [118, 95],
        [65, 103],
        [45, 158],
        [0, 173],
      ],
      [
        [31, 12],
        [90, 0],
        [59, 115],
        [152, 90],
        [132, 145],
        [0, 169],
      ],
      [
        [40, 19],
        [141, 0],
        [169, 32],
        [133, 137],
        [32, 164],
        [0, 134],
        [23, 54],
      ],
      [
        [21, 14],
        [71, 2],
        [52, 91],
        [89, 42],
        [115, 40],
        [115, 84],
        [154, 1],
        [204, 0],
        [149, 146],
        [103, 165],
        [92, 118],
        [46, 169],
        [0, 152],
      ],
    ];
    g.save();
    g.translate(182, 48);
    g.scale(1.63, 1.63);
    g.transform(1, -0.02, -0.1, 1, 0, 0);
    for (let i = 0; i < letters.length; i++) {
      const path = new Path2D();
      letters[i].forEach(([x, y], j) => (j ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      if (i === 2) {
        path.moveTo(68, 60);
        path.lineTo(54, 112);
        path.lineTo(93, 100);
        path.lineTo(108, 47);
        path.closePath();
      }
      g.lineJoin = 'miter';
      g.miterLimit = 2;
      g.save();
      g.translate(7, 9);
      g.strokeStyle = '#18a7a5';
      g.lineWidth = 19;
      g.stroke(path);
      g.restore();
      g.strokeStyle = '#20182c';
      g.lineWidth = 13;
      g.stroke(path);
      const fill = g.createLinearGradient(0, 12, 0, 167);
      fill.addColorStop(0, '#ffed94');
      fill.addColorStop(0.52, '#ffae48');
      fill.addColorStop(0.53, '#ff824a');
      fill.addColorStop(1, '#eb4966');
      g.fillStyle = fill;
      g.fill(path, 'evenodd');
      g.strokeStyle = '#ffe6a4';
      g.lineWidth = 1.6;
      g.stroke(path);
      g.translate(i === 0 ? 146 : i === 1 ? 139 : 161, 0);
    }
    g.restore();
    for (let row = 0; row < 12; row++) {
      g.fillStyle = '#15152235';
      g.fillRect(0, row * 32, w, 2);
      for (let i = 0; i < 15; i++) g.fillRect(i * 110 + (row % 2) * 55, row * 32, 2, 32);
    }
    flecks(g, w, h, 23000);
  });
  panel('FLOW mural', 2, 1.48, -12.59, 13.3, 2.8, Math.PI, mural, 0.34);
  // Painted enamel signs use one artwork per venue. Alphabet is kept legible from the hall.
  function sign(name, sub, x, y, z, w, h, angle, accent) {
    const tex = texture(name, 768, 192, (g, W, H) => {
      g.fillStyle = '#171922';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = accent;
      g.lineWidth = 6;
      g.strokeRect(9, 9, W - 18, H - 18);
      g.fillStyle = accent;
      g.font = 'bold 22px sans-serif';
      g.textAlign = 'center';
      g.fillText(sub, W / 2, 45);
      g.font = '900 103px sans-serif';
      g.fillStyle = '#fff1d6';
      g.fillText(name, W / 2, 150, W - 70);
      for (const x of [21, W - 21])
        for (const y of [21, H - 21]) {
          g.fillStyle = '#b69a77';
          g.fillRect(x - 2, y - 2, 4, 4);
        }
      flecks(g, W, H, 2200);
    });
    panel(name, x, y, z, w, h, angle, tex, 0.75);
  }
  sign('MAIN HALL', 'S T R E E T   S E S S I O N S', 0, 3.55, 10, 5.5, 1.05, Math.PI, '#ffb14c');
  for (const x of [-2.45, 2.45]) box('sign drop', x, 4.1, 9.95, 0.055, 0.55, 0.06, brass);
  box('entrance crossbar', 0, 4.38, 9.95, 17.6, 0.14, 0.17, iron);
  sign('BATTLE', 'E A S T   A L L E Y', 12.4, 3.55, -12.64, 5.5, 1.3, Math.PI, '#ffa84c');
  sign('CREW', 'E A S T   L O U N G E', 12.4, 2.5, 13.9, 5.3, 1.02, Math.PI, '#b998ff');
  sign('BAR', 'W E S T   C O R N E R', -12.4, 2.5, 13.9, 5.3, 1.02, Math.PI, '#ff775a');
  sign('ROOFTOP', 'W E S T   S T A I R', -11.8, 3.64, -14.04, 4.45, 1, Math.PI, '#66ded3');
  sign('STREET', 'W E S T   L O U N G E', -12.5, 1.47, -6.78, 5.1, 1.03, Math.PI, '#65ded7');
  // A district skyline and backlit industrial windows complete the view above the alley.
  const windowBank = texture('steel sash', 512, 256, (g, w, h) => {
    g.fillStyle = '#252533';
    g.fillRect(0, 0, w, h);
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 10; i++) {
        const x = 9 + i * 50,
          y = 8 + j * 82;
        g.fillStyle = ['#b27846', '#594c58', '#e9ad65', '#554b5a', '#797079'][
          Math.floor(random() * 5)
        ];
        g.fillRect(x, y, 43, 70);
        g.fillStyle = '#292736';
        g.fillRect(x + 20, y, 3, 70);
        g.fillRect(x, y + 33, 43, 3);
        g.fillStyle = '#ffffff10';
        g.fillRect(x + 3, y + 3, 15, 28);
      }
  });
  const masonry = material('warehouse masonry', '#594956'),
    coping = material('roof flashing', '#373440');
  for (let i = 0; i < 8; i++) {
    const x = -24 + i * 7.1,
      h = [7.7, 10.2, 8.3, 11.2, 8.6, 7.9, 9.4, 7.3][i],
      z = -26 - (i % 3) * 1.4;
    box('warehouse block', x, h / 2, z, 6.9, h, 4, masonry);
    box('cornice', x, h, z, 7.1, 0.22, 4.2, coping);
    panel('sash windows', x, h - 2.6, z + 2.02, 6.3, 4.3, Math.PI, windowBank, 0.44);
    box('roof unit', x + 1, h + 0.4, z, 1.1, 0.8, 1, coping);
  }
  for (const x of [-2.17, 0.83, 3.83, 6.83]) {
    panel('transom', x, 3.53, -12.56, 1.59, 1.71, Math.PI, windowBank, 0.56);
    box('window sill', x, 2.64, -12.52, 1.83, 0.11, 0.29, iron);
  }
  // A riveted rooftop water tank breaks the warehouse silhouette.
  const tank = B.MeshBuilder.CreateCylinder(
    'decor/water tank',
    { height: 2.2, diameter: 2.1, tessellation: 16 },
    scene,
  );
  tank.position.set(-8, 9.65, -25);
  tank.material = coping;
  for (const y of [8.7, 9.6, 10.65]) {
    const hoop = B.MeshBuilder.CreateTorus(
      'decor/tank hoop',
      { diameter: 2.09, thickness: 0.064, tessellation: 24 },
      scene,
    );
    hoop.position.set(-8, y, -25);
    hoop.material = brass;
  }
  for (const a of [-0.68, 0.68])
    for (const b of [-0.68, 0.68]) box('tank leg', -8 + a, 8, -25 + b, 0.09, 1.35, 0.09, iron);
  sign(
    'BLOCK RECORDS',
    'I N D E P E N D E N T   S O U N D',
    2,
    5.93,
    -12.78,
    8.4,
    1.35,
    Math.PI,
    '#eaa460',
  );
  for (const x of [-1.1, 5.1]) box('roof sign brace', x, 5.55, -12.9, 0.09, 1.5, 0.1, iron);
  // Ribbed awnings, poster bills and wall-mounted strip lights face the cross alleys.
  const crimson = material('oxblood canopy', '#ab3444'),
    navy = material('petrol canopy', '#306267');
  const bill = texture('gig bills', 512, 256, (g, w, h) => {
    g.fillStyle = '#302b38';
    g.fillRect(0, 0, w, h);
    ['BEAT', 'JAM', 'LIVE', 'MIX'].forEach((s, i) => {
      g.save();
      g.translate(i * 126 + 12, 12 + (i % 2) * 9);
      g.rotate(((i % 2) - 0.5) * 0.06);
      g.fillStyle = ['#e6b655', '#45968e', '#d48da0', '#e0c392'][i];
      g.fillRect(0, 0, 116, 221);
      g.fillStyle = '#342c3b';
      g.font = '900 38px sans-serif';
      g.fillText(s, 5, 42, 105);
      for (let j = 0; j < 6; j++) {
        g.beginPath();
        g.arc(57, 113, 11 + j * 6, 0, Math.PI * 2);
        g.strokeStyle = '#372d41';
        g.lineWidth = 2;
        g.stroke();
      }
      for (let j = 0; j < 4; j++) g.fillRect(10, 170 + j * 8, 94 - j * 13, 3);
      g.restore();
    });
    flecks(g, w, h, 5000);
  });
  for (const side of [-1, 1])
    for (const [i, z] of [
      [0, 11.25],
      [1, 5.65],
      [2, -0.5],
      [3, -6.3],
    ]) {
      const awning = box(
        'shop canopy',
        side * 8.65,
        2.67,
        z,
        0.93,
        0.14,
        2.52,
        i % 2 ? navy : crimson,
      );
      awning.rotation.z = side * 0.16;
      for (let k = 0; k < 9; k++)
        box(
          'canopy rib',
          side * 8.62,
          2.76,
          z - 1.19 + k * 0.29,
          0.9,
          0.03,
          0.045,
          iron,
        ).rotation.z = side * 0.16;
      box('shop tube', side * 8.28, 2.56, z, 0.09, 0.09, 2.23, side === 1 ? gold : mint);
      panel('gig posters', side * 8.64, 1.48, z, 1.92, 1.1, (side * Math.PI) / 2, bill, 0.23);
    }
  // Two swags over the hall, safely above the existing navigation envelope.
  for (const z of [6, -7]) {
    const points = [];
    for (let i = 0; i <= 16; i++) {
      const x = i - 8,
        y = 4.65 - 0.72 * (1 - (x / 8) ** 2);
      points.push(new B.Vector3(x, y, z));
      if (i % 2 === 1) {
        box('bulb holder', x, y - 0.06, z, 0.09, 0.14, 0.09, iron);
        const bulb = B.MeshBuilder.CreateSphere(
          'decor/filament',
          { diameter: 0.145, segments: 6 },
          scene,
        );
        bulb.position.set(x, y - 0.18, z);
        bulb.material = gold;
        bulb.isPickable = false;
      }
    }
    B.MeshBuilder.CreateTube(
      'decor/cable',
      { path: points, radius: 0.018, tessellation: 5 },
      scene,
    ).material = iron;
  }
  for (const s of [-1, 1]) {
    box('hall post trim', s * 5.12, 2, -5.25, 0.075, 3.4, 0.09, s < 0 ? mint : red);
    box('hall fascia', s * 5.07, 3.87, 0.2, 0.1, 0.055, 10.1, brass);
  }
  // Feathered pools under practical lamps keep the coloured spill on the paving.
  const pool = texture('lamp falloff', 128, 128, (g, w, h) => {
    const falloff = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    falloff.addColorStop(0, 'rgba(255,255,255,.78)');
    falloff.addColorStop(0.45, 'rgba(255,255,255,.38)');
    falloff.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = falloff;
    g.fillRect(0, 0, w, h);
  });
  pool.hasAlpha = true;
  for (const [x, z, w, d, hex] of [
    [-7, 8, 5, 7, '#36c6c8'],
    [7, 7, 5, 8, '#ff8a44'],
    [-7, -3, 5, 6, '#3999aa'],
    [10, -8, 6, 6, '#ff9b47'],
    [1, -9, 8, 6, '#ff9244'],
    [-12, -17, 5, 4, '#8057b7'],
  ]) {
    const spill = B.MeshBuilder.CreateGround('decor/lamp spill', { width: w, height: d }, scene);
    spill.position.set(x, z === -17 ? 3.515 : 0.015, z);
    const m = material('pool ' + hex, hex);
    m.disableLighting = true;
    m.emissiveColor = color(hex);
    m.diffuseTexture = pool;
    m.useAlphaFromDiffuseTexture = true;
    m.alpha = 0.52;
    m.alphaMode = B.Engine.ALPHA_ADD;
    spill.material = m;
    spill.isPickable = false;
  }
  scene.clearColor = new B.Color4(0.1, 0.077, 0.145, 1);
  scene.getLightByName('sky').intensity = 0.68;
  scene.getLightByName('sky').diffuse = color('#d8c8e5');
  scene.getLightByName('sun').intensity = 0.68;
  scene.getLightByName('sun').diffuse = color('#ffce9a');
  for (const [x, y, z, hex, intensity, range] of [
    [0, 4, 7, '#ffc27e', 17, 14],
    [1, 3, -9, '#ffad74', 23, 15],
    [-9, 2.5, 1, '#44b6c1', 15, 11],
    [10, 3, -5, '#ff825a', 20, 14],
    [-13, 5, -17, '#ac90ff', 12, 10],
  ]) {
    const light = new B.PointLight('alley practical', new B.Vector3(x, y, z), scene);
    light.diffuse = color(hex);
    light.intensity = intensity;
    light.range = range;
  }
  for (const m of scene.materials) if ('maxSimultaneousLights' in m) m.maxSimultaneousLights = 7;
}
