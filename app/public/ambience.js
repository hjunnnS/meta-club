// Music spectrum plus short whole-room lighting pulses; no sparkle particles.
export const strobeDurations = {normal:1.2, transition:2.3};
export function strobePattern(elapsed, kind = 'transition') {
  if (!Object.hasOwn(strobeDurations,kind) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= strobeDurations[kind]) return 0;
  const ms = Math.floor(elapsed * 1000 + .000001);
  if (kind === 'normal') {
    // Two fast flashes, a gap, repeated in three groups.
    const groupTime=ms%500;
    return groupTime<200 && Math.floor(groupTime/50)%2===0 ? 1 : 0;
  }
  if (ms>=1800) return ms>=2100 ? 1 : 0;
  const start = ms < 600 ? 0 : ms < 1200 ? 600 : 1200;
  const interval = start === 0 ? 150 : start === 600 ? 100 : 50;
  return Math.floor((ms-start)/interval)%2 === 0 ? 1 : 0;
}

export function clubAmbience(B, scene) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const ink=new B.ShaderMaterial('Music spectrum neon',scene,{
    vertexSource:'precision highp float;attribute vec3 position;attribute vec4 color;uniform mat4 worldViewProjection;varying vec4 tint;void main(){tint=color;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource:'precision highp float;varying vec4 tint;void main(){gl_FragColor=vec4(tint.rgb*.85,1.);}'
  },{attributes:['position','color'],uniforms:['worldViewProjection']});
  const bars=new B.SolidParticleSystem('LED side equalizers',scene);
  const cube=B.MeshBuilder.CreateBox('spectrum bar template',{width:.21,height:.23,depth:.12},scene);
  bars.addShape(cube,24*14);cube.dispose();
  const mesh=bars.buildMesh();mesh.material=ink;mesh.isPickable=false;
  const backing=new B.StandardMaterial('Equalizer dark contrast',scene);
  backing.disableLighting=true;backing.emissiveColor=new B.Color3(.012,.008,.022);
  for(const x of [-7,7]) {
    const panel=B.MeshBuilder.CreateBox('Equalizer backing',{width:3.7,height:4.8,depth:.08},scene);
    panel.position.set(x,3.25,20.45);panel.material=backing;panel.isPickable=false;
  }
  let bands=[];
  bars.updateParticle=p=>{
    const column=Math.floor(p.idx/14),i=column%12,side=column<12?-1:1,level=p.idx%14;
    const energy=bands[i]||0;
    p.isVisible=level<Math.max(1,Math.round(energy*14));
    // Face into the room from the entrance wall, clear of the central doorway.
    p.position.set(side<0?-8.595+i*.29:5.405+i*.29,1.05+level*.32,20.32);
    p.color ||= new B.Color4();
    const blend=level/13;
    if(side<0)p.color.set(1,.64-.44*blend,.08+.38*blend,1);
    else p.color.set(.65+.35*blend,1-.40*blend,.10,1);
    return p;
  };
  return (beat,values,strobing=false,playing=false,bpm=120,previewAge=null,previewKind='transition')=>{
    bands=values;
    bars.setParticles();
    if (strobing || calm.matches) return 0;
    if (previewAge !== null) {
      return strobePattern(previewAge,previewKind);
    }
    if (!playing) return 0;
    const bass=((values[0]||0)+(values[1]||0)+(values[2]||0))/3;
    if (bass<.02) return 0;
    // Normal accent halfway through the phrase; the large accent owns its transition.
    const phase=((beat%32)+32)%32;
    const kind=phase<16?'transition':'normal';
    const elapsed=(phase<16?phase:phase-16)*60/Math.max(1,bpm);
    return strobePattern(elapsed,kind)*(.7+.3*bass);
  };
}
