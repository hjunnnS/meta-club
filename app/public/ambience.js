// Music spectrum plus short whole-room lighting pulses; no sparkle particles.
import {strobeDurations,strobeSchedule} from '../../stage/festival/events.js';
export {strobeDurations};
export function strobePattern(elapsed, kind = 'transition') {
  if (!Object.hasOwn(strobeDurations,kind) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= strobeDurations[kind]) return 0;
  const ms = Math.floor(elapsed * 1000 + .000001);
  if (kind === 'normal') {
    // Paired flashes with breathing gaps for the full five-second look.
    const groupTime=ms%650;
    return groupTime<200 && Math.floor(groupTime/50)%2===0 ? 1 : 0;
  }
  if(ms<1000)return Math.floor(ms/250)%2===0?1:0;
  if(ms<2000)return Math.floor((ms-1000)/125)%2===0?1:0;
  if(ms<4000)return Math.floor((ms-2000)/50)%2===0?1:0;
  if(ms<5000)return 0;
  if(ms>=6700)return 1;
  return (ms-5000)%600<200?1:0;
}

export function clubAmbience(B, scene) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const ink=new B.ShaderMaterial('Music spectrum neon',scene,{
    vertexSource:'precision highp float;attribute vec3 position;attribute vec4 color;uniform mat4 worldViewProjection;varying vec4 tint;void main(){tint=color;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource:'precision highp float;varying vec4 tint;void main(){gl_FragColor=vec4(tint.rgb*.85,1.);}'
  },{attributes:['position','color'],uniforms:['worldViewProjection']});
  const bars=new B.SolidParticleSystem('LED side equalizers',scene);
  bars.computeBoundingBox=true;
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
  return (beat,values,strobing=false,playing=false,bpm=120,previewAge=null,previewKind='transition',arrangement=1)=>{
    bands=values;
    bars.setParticles();
    if (strobing || calm.matches) return 0;
    if (previewAge !== null) {
      return strobePattern(previewAge,previewKind);
    }
    if (!playing || arrangement<.55) return 0;
    const bass=((values[0]||0)+(values[1]||0)+(values[2]||0))/3;
    if (bass<.02) return 0;
    // Normal accent halfway through the phrase; the large accent owns its transition.
    const {kind,elapsed}=strobeSchedule(beat,bpm);
    return strobePattern(elapsed,kind)*(.7+.3*bass)*Math.min(1,arrangement);
  };
}
