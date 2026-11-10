// Deterministic particles share the channel event's elapsed time, including late joins.
export function celebration(B, scene, root, seconds) {
  const ink = new B.StandardMaterial('celebration particles', scene);
  ink.disableLighting = true;
  ink.emissiveColor = B.Color3.White();
  ink.backFaceCulling = false;
  const sparks = new B.SolidParticleSystem('stage fountain sparks', scene);
  const sparkShape = B.MeshBuilder.CreateSphere('spark template', {diameter: .10, segments: 3}, scene);
  sparks.addShape(sparkShape, 240);
  sparkShape.dispose();
  const sparkMesh = sparks.buildMesh();
  sparkMesh.parent = root;
  sparkMesh.material = ink;
  sparkMesh.isPickable = false;
  const confetti = new B.SolidParticleSystem('audience confetti', scene);
  const paper = B.MeshBuilder.CreatePlane('paper template', {width: .15, height: .24}, scene);
  confetti.addShape(paper, 260);
  paper.dispose();
  const paperMesh = confetti.buildMesh();
  paperMesh.parent = root;
  paperMesh.material = ink;
  paperMesh.isPickable = false;
  const palette = ['#ffdd87','#fff4d7','#afafff','#ffb5d6'].map(B.Color3.FromHexString);
  const noise = (index, salt) => {
    const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  let time = 0;
  sparks.updateParticle = p => {
    const i = p.idx, emitter = Math.floor(i / 60);
    const age = time - (i % 60) / 60 * 1.45;
    const life = .65 + noise(i,1)*.55;
    p.isVisible = age >= 0 && age < life;
    if (!p.isVisible) return p;
    const angle = noise(i,2)*Math.PI*2;
    const velocity = 4.6 + noise(i,3)*2.4;
    p.position.set([-5.6,-2.8,2.8,5.6][emitter] + Math.cos(angle)*age*.55,
      1.4 + velocity*age - 4*age*age, -10.05 + Math.sin(angle)*age*.55);
    p.scaling.setAll(.65+noise(i,4));
    p.color = new B.Color4(1, .76+noise(i,5)*.24, .43+noise(i,6)*.55, Math.min(1,(life-age)*5));
    return p;
  };
  confetti.updateParticle = p => {
    const i=p.idx;
    const age = time - (seconds - 7) - noise(i,7)*1.1;
    const y = 6.7 - age*(.85+noise(i,8)*.30);
    p.isVisible = age >= 0 && y > .15;
    if (!p.isVisible) return p;
    // Keep the east lounge wall and its sign clear; confetti falls over the audience circle.
    const angle=noise(i,9)*Math.PI*2, radius=1.3+noise(i,10)*5.8;
    p.position.set(Math.cos(angle)*radius + .45*Math.sin(age*1.7+i),
      y, 2+Math.sin(angle)*radius + age*.27);
    p.rotation.set(age*(1+noise(i,11)*3), age*.9+i, age*1.4+i);
    const c=palette[i%palette.length];
    p.color=new B.Color4(c.r,c.g,c.b,Math.min(1,age*3,y*2));
    return p;
  };
  return elapsed => {
    time = elapsed;
    sparkMesh.setEnabled(elapsed < 2.7);
    if (sparkMesh.isEnabled()) sparks.setParticles();
    paperMesh.setEnabled(elapsed >= seconds-7);
    if (paperMesh.isEnabled()) confetti.setParticles();
  };
}
