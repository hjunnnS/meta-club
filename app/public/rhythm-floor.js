// One non-colliding surface: annular chase, alternating grid and diagonal grid flow.
export function rhythmFloor(B, scene) {
  const mesh = B.MeshBuilder.CreateGround('dance floor keys', { width: 16.6, height: 16.6 }, scene);
  mesh.position.y = 0.042;
  mesh.isPickable = false;
  const material = new B.ShaderMaterial('rhythm tiles', scene, {
    vertexSource: 'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec2 p; void main(){p=position.xz;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource: `precision highp float;
      varying vec2 p;
      uniform float beat, intensity, celebration, accent, cueBeat, pattern, previousPattern, patternMix, stepRate, transitionAccent, flash, sceneWhite;
      uniform vec3 cueColor, sceneColor, sceneLight;
      // x is the lit amount; y masks the gaps for this pattern's actual tile layout.
      vec2 floorLook(float kind){
        float radius=length(p),band=(radius-.85)/2.45;
        float slice=(atan(p.y,p.x)+3.141593)*16./6.283185;
        float annularGap=step(.035,fract(band))*step(.026,fract(slice));
        vec2 cell=floor(p/1.15),within=fract(p/1.15);
        float gridGap=step(.045,within.x)*step(.045,within.y);
        float phase=beat*stepRate,pass=smoothstep(.80,1.,fract(phase));
        if(kind>.5 && kind<1.5){
          float parity=mod(cell.x+cell.y+floor(phase),2.);
          return vec2(.04+.92*mix(parity,1.-parity,pass),gridGap);
        }
        if(kind>2.5){
          float stripe=mod(cell.x+cell.y-floor(phase),8.);
          float current=1.-step(2.,stripe);
          float next=1.-step(2.,mod(stripe-1.,8.));
          return vec2(.05+.90*mix(current,next,pass),gridGap);
        }
        if(kind>1.5){
          float halo=1.-smoothstep(.12,.65,abs(mod(radius-beat*.38+24.,2.6)-1.3));
          return vec2(.28+.58*halo,annularGap);
        }
        float phaseRing=beat-.16*floor(band),offset=mod(floor(slice)-floor(phaseRing),8.);
        float handoff=smoothstep(.34,.95,fract(phaseRing));
        float current=1.-step(.5,offset),next=1.-step(.5,abs(offset-1.));
        float trail=1.-step(.5,abs(offset-7.));
        return vec2(current*(1.-handoff)+next*handoff+trail*.14*(1.-handoff),annularGap);
      }
      float isGrid(float kind){return kind>.5&&kind<1.5||kind>2.5?1.:0.;}
      void main(){
        float radius=length(p);if(radius>8.2||radius<.85)discard;
        vec2 tile=mix(floorLook(previousPattern),floorLook(pattern),patternMix);
        float lit=tile.x;
        float grid=mix(isGrid(previousPattern),isGrid(pattern),patternMix);
        lit=max(lit,accent*mix(.55,.18,grid));
        if(cueBeat>=1.80&&cueBeat<5.20){
          float travel=smoothstep(2.14,5.20,cueBeat),front=mix(9.2,28.,travel);
          float wave=1.-smoothstep(.3,2.1,abs(length(p-vec2(0.,-17.))-front));
          wave*=smoothstep(1.80,2.04,cueBeat)*(1.-smoothstep(1.5+12.*travel,2.5+12.*travel,abs(p.x)));
          lit=max(lit,wave);
        }
        lit=max(lit,transitionAccent);
        vec3 color=mix(sceneColor,sceneLight,clamp(lit*.85+sceneWhite*.25,0.,1.));
        color=mix(color,vec3(1.,.96,.90),max(flash*.90,sceneWhite*.35));
        lit=max(lit,flash);
        float alpha=mix(.18+.82*lit,.96,grid)*tile.y;
        gl_FragColor=vec4(mix(vec3(.008,.009,.02),color,lit),intensity*alpha);
      }`
  }, { attributes:['position'], uniforms:['worldViewProjection','beat','intensity','celebration','accent','cueBeat','cueColor','pattern','previousPattern','patternMix','stepRate','transitionAccent','flash','sceneColor','sceneLight','sceneWhite'], needAlphaBlending:true });
  material.backFaceCulling = false;
  mesh.material = material;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  return (beat, celebrating, accent, cueBeat, cueColor, pattern = 0, flash = 0, look = null, playing = false) => {
    const active=playing&&!calm.matches,b=active?Math.max(0,beat):0;
    const block=Math.floor(b/16),sequence=[0,1,3];
    const current=pattern||sequence[block%3];
    const previous=pattern||sequence[Math.max(0,block-1)%3];
    const progress=active?Math.min(1,(b%16)/.65):1;
    material.setFloat('previousPattern',previous);
    material.setFloat('patternMix',progress*progress*(3-2*progress));
    material.setFloat('stepRate',active&&((look?.opening||0)>.05||b%32>=28)?2:1);
    material.setFloat('transitionAccent',active&&block>0&&b%32<.35?(1-b%32/.35)*.92:0);
    material.setColor3('sceneColor',B.Color3.FromHexString(look?.primary||'#9e6dff'));
    material.setColor3('sceneLight',B.Color3.FromHexString(look?.secondary||'#9deaff'));
    material.setFloat('sceneWhite',calm.matches?0:look?.white||0);
    material.setFloat('flash', calm.matches ? 0 : flash);
    material.setFloat('pattern', active?current:0);
    if(!active)material.setFloat('previousPattern',0);
    material.setColor3('cueColor', cueColor);
    material.setFloat('cueBeat', active?cueBeat:-1);
    material.setFloat('accent', active?accent:0);
    material.setFloat('celebration', celebrating ? 1 : 0);
    material.setFloat('beat', b);
    material.setFloat('intensity', calm.matches ? 0.42 : look?.floor??0.9);
  };
}
