// Deterministic particles share the channel event's elapsed time, including late joins.
export function celebration(B, scene, root, seconds, holographic = false, selection = 'both', bpm = 120) {
  const ink = new B.StandardMaterial('celebration particles', scene);
  ink.disableLighting = true;
  ink.emissiveColor = B.Color3.White();
  ink.backFaceCulling = false;
  const sparks = new B.SolidParticleSystem('stage fountain sparks', scene);
  sparks.computeBoundingBox=true;
  const sparkShape = B.MeshBuilder.CreateSphere('spark template', {diameter: .04, segments: 3}, scene);
  sparks.addShape(sparkShape, 720);
  sparkShape.dispose();
  const sparkMesh = sparks.buildMesh();
  sparkMesh.parent = root;
  sparkMesh.material = ink;
  sparkMesh.isPickable = false;
  const confetti = new B.SolidParticleSystem('audience confetti', scene);
  confetti.computeBoundingBox=true;
  const paper = B.MeshBuilder.CreatePlane('paper template', {width: .15, height: .24}, scene);
  confetti.addShape(paper, 520);
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
  let glitter, glitterMesh;
  if (holographic) {
    glitter = new B.SolidParticleSystem('hologram gathering glints',scene);
    const diamond = B.MeshBuilder.CreatePolyhedron('glint template',{type:1,size:.10},scene);
    glitter.addShape(diamond,96);diamond.dispose();
    glitterMesh=glitter.buildMesh();glitterMesh.parent=root;glitterMesh.material=ink;glitterMesh.isPickable=false;
    glitter.updateParticle=p=>{
      const ending=time>seconds-2.8;
      const phase=ending?(time-(seconds-2.8))/2.8:time/2.3;
      const angle=noise(p.idx,13)*Math.PI*2;
      const radius=(ending?phase:1-phase)*(1.2+noise(p.idx,14)*3.7);
      p.position.set(3+radius*Math.cos(angle),4.2+(noise(p.idx,15)-.5)*radius,1+radius*Math.sin(angle));
      const blink=.35+.65*Math.abs(Math.sin(time*7+p.idx));
      p.scaling.setAll(blink);
      p.color=new B.Color4(.75+noise(p.idx,16)*.25,.85,1,Math.min(1,Math.max(0,1-phase)*3));
      return p;
    };
  }
  let time = 0;
  sparks.updateParticle = p => {
    const i = p.idx, emitter = Math.floor(i / 120), core = i%5!==0;
    const offset=(i%120)/120*1.55;
    let emitted=offset+Math.floor(Math.max(0,time-offset)/1.65)*1.65;
    if(emitted>3.2)emitted-=1.65;
    const age = time - emitted;
    const life = 1.10 + noise(i,1)*.50;
    p.isVisible = age >= 0 && age < life;
    if (!p.isVisible) return p;
    const angle = noise(i,2)*Math.PI*2;
    const velocity = 7.0 + noise(i,3)*2.0;
    const spread=core?.65+age*.45:1.3+age*.5;
    p.position.set([-6.3,-4.2,-2.1,2.1,4.2,6.3][emitter] + Math.cos(angle)*age*spread,
      1.4 + velocity*age - 4*age*age, -10.05 + Math.sin(angle)*age*spread*.55);
    p.scaling.setAll(.65+noise(i,4));
    p.scaling.y *= (core?7:4)*(.85+.15*Math.cos(time*bpm/60*Math.PI*2));
    p.color = new B.Color4(1, core?.94:.76+noise(i,5)*.24, core?.80:.43+noise(i,6)*.55, Math.min(1,(life-age)*5));
    return p;
  };
  confetti.updateParticle = p => {
    const i=p.idx;
    const age = time - (seconds - 7) - noise(i,7)*.18;
    const y = 7.4+1.8*Math.min(age,.5)-1.35*Math.max(0,age-.5);
    p.isVisible = age >= 0 && y > .15;
    if (!p.isVisible) return p;
    // Eight bursts around the ceiling rings: outward launch, then flutter down.
    const emitter=(i%8)*Math.PI/4,angle=emitter+(noise(i,9)-.5)*.8;
    const travel=(2+noise(i,10)*3.6)*(1-Math.exp(-age*3))+age*.15;
    p.position.set(6*Math.cos(emitter)+Math.cos(angle)*travel+.35*Math.sin(age*1.7+i),
      y,1+6*Math.sin(emitter)+Math.sin(angle)*travel+.35*Math.sin(age*1.3+i));
    p.rotation.set(age*(1+noise(i,11)*3), age*.9+i, age*1.4+i);
    const c=palette[i%palette.length];
    p.color=new B.Color4(c.r,c.g,c.b,Math.min(1,age*3,y*2));
    return p;
  };
  return elapsed => {
    time = elapsed;
    if (glitterMesh) {
      glitterMesh.setEnabled(elapsed<2.3 || elapsed>seconds-2.8);
      if(glitterMesh.isEnabled())glitter.setParticles();
    }
    sparkMesh.setEnabled(selection !== 'confetti' && elapsed < 4.9);
    if (sparkMesh.isEnabled()) sparks.setParticles();
    paperMesh.setEnabled(selection !== 'fountain' && elapsed >= seconds-7);
    if (paperMesh.isEnabled()) confetti.setParticles();
  };
}
