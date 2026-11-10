// Music spectrum plus short whole-room lighting pulses; no sparkle particles.
export function clubAmbience(B, scene) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const ink=new B.ShaderMaterial('Music spectrum neon',scene,{
    vertexSource:'precision highp float;attribute vec3 position;attribute vec4 color;uniform mat4 worldViewProjection;varying vec4 tint;void main(){tint=color;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource:'precision highp float;varying vec4 tint;void main(){gl_FragColor=vec4(tint.rgb*.65,1.);}'
  },{attributes:['position','color'],uniforms:['worldViewProjection']});
  const bars=new B.SolidParticleSystem('LED side equalizers',scene);
  const cube=B.MeshBuilder.CreateBox('spectrum bar template',{width:.21,height:.23,depth:.12},scene);
  bars.addShape(cube,24*14);cube.dispose();
  const mesh=bars.buildMesh();mesh.material=ink;mesh.isPickable=false;
  let bands=[];
  bars.updateParticle=p=>{
    const column=Math.floor(p.idx/14),i=column%12,side=column<12?-1:1,level=p.idx%14;
    const energy=bands[i]||0;
    p.isVisible=level<Math.max(1,Math.round(energy*14));
    // Same plane as the large screen, outside its left/right edges.
    p.position.set(side<0?-8.9+i*.29:13+i*.29,2.6+level*.32,-13.8);
    p.color ||= new B.Color4();
    p.color.set(.25+level*.05,.90-level*.04,1,1);
    return p;
  };
  return (beat,values,strobing=false,playing=false,bpm=120,previewAge=null)=>{
    bands=values;
    bars.setParticles();
    if (strobing || calm.matches) return 0;
    if (previewAge !== null) {
      return previewAge>=0 && previewAge<1.6 && Math.floor(previewAge/.1)%2===0 ? 1 : 0;
    }
    if (!playing) return 0;
    const bass=((values[0]||0)+(values[1]||0)+(values[2]||0))/3;
    if (bass<.02) return 0;
    // One 1.6-second strobe burst at each eight-bar transition, then normal lighting.
    const phase=((beat%32)+32)%32;
    const elapsed=phase*60/Math.max(1,bpm);
    if (elapsed>=1.6) return 0;
    return Math.floor(elapsed/.1)%2===0 ? .7+.3*bass : 0;
  };
}
