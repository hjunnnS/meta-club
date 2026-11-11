// Three annular bands, one draw call. Tile gaps reveal the approved original floor.
export function rhythmFloor(B, scene) {
  const mesh = B.MeshBuilder.CreateGround('dance floor keys', { width: 16.6, height: 16.6 }, scene);
  mesh.position.y = 0.042;
  mesh.isPickable = false;
  const material = new B.ShaderMaterial('rhythm tiles', scene, {
    vertexSource: 'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec2 p; void main(){p=position.xz;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource: `precision highp float;
      varying vec2 p; uniform float beat; uniform float intensity; uniform float celebration; uniform float accent; uniform float cueBeat; uniform vec3 cueColor; uniform float pattern; uniform float flash; uniform vec3 sceneColor; uniform vec3 sceneLight; uniform float sceneWhite;
      void main(){
        float radius=length(p); if(radius>8.2 || radius<0.85) discard;
        float band=(radius-.85)/2.45;
        float slice=(atan(p.y,p.x)+3.141593)*16./6.283185;
        if(fract(band)<.035 || fract(slice)<.026) discard;
        // Two opposite fronts advance one neighboring sector on each beat.
        float phase=beat-.16*floor(band);
        float offset=mod(floor(slice)-floor(phase),8.);
        float handoff=smoothstep(.34,.95,fract(phase));
        float current=1.-step(.5,offset);
        float next=1.-step(.5,abs(offset-1.));
        float trail=1.-step(.5,abs(offset-7.));
        float lit=current*(1.-handoff)+next*handoff+trail*.14*(1.-handoff);
        vec3 color=mix(vec3(.16,.94,1.),vec3(.92,.46,.96),floor(band)*.37);
        color=mix(color,vec3(1.,.65,.24),celebration*.55);
        lit=max(lit,accent*(.35+.30*(1.-fract(band))));
        color=mix(color,vec3(.55,1.,.91),accent*.65);
        if(cueBeat>=1.80 && cueBeat<5.20){
          // Light the stage-facing tile first; the front then widens across the audience.
          float travel=smoothstep(2.14,5.20,cueBeat);
          float front=mix(9.2,28.,travel);
          float wave=1.-smoothstep(.3,2.1,abs(length(p-vec2(0.,-17.))-front));
          wave*=smoothstep(1.80,2.04,cueBeat)
            *(1.-smoothstep(1.5+12.*travel,2.5+12.*travel,abs(p.x)));
          color=mix(color,cueColor,wave);
          lit=max(lit,wave);
        }
        if(pattern>.5 && pattern<1.5){
          float checker=mod(floor(p.x/1.15)+floor(p.y/1.15)+floor(beat),2.);
          color=mix(vec3(.28,.06,.74),vec3(.93,.29,.72),checker);
          lit=.38+.48*checker;
        }
        if(pattern>1.5){
          float halo=1.-smoothstep(.12,.65,abs(mod(radius-beat*.38+24.,2.6)-1.3));
          color=mix(vec3(.34,.31,.53),vec3(.88,.79,.99),halo);
          lit=.28+.58*halo;
        }
        color=mix(sceneColor,sceneLight,clamp(lit*.78+sceneWhite,0.,1.));
        color=mix(color,vec3(1.,.96,.90),max(flash*.90,sceneWhite));lit=max(lit,flash);
        gl_FragColor=vec4(mix(vec3(.12,.12,.24),color,lit),intensity*(.18+.82*lit));
      }`
  }, { attributes:['position'], uniforms:['worldViewProjection','beat','intensity','celebration','accent','cueBeat','cueColor','pattern','flash','sceneColor','sceneLight','sceneWhite'], needAlphaBlending:true });
  material.backFaceCulling = false;
  mesh.material = material;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  return (beat, celebrating, accent, cueBeat, cueColor, pattern = 0, flash = 0, look = null) => {
    material.setColor3('sceneColor',B.Color3.FromHexString(look?.primary||'#9e6dff'));
    material.setColor3('sceneLight',B.Color3.FromHexString(look?.secondary||'#9deaff'));
    material.setFloat('sceneWhite',calm.matches?0:look?.white||0);
    material.setFloat('flash', calm.matches ? 0 : flash);
    material.setFloat('pattern', pattern);
    material.setColor3('cueColor', cueColor);
    material.setFloat('cueBeat', cueBeat);
    material.setFloat('accent', accent);
    material.setFloat('celebration', celebrating ? 1 : 0);
    material.setFloat('beat', beat);
    material.setFloat('intensity', calm.matches ? 0.42 : look?.floor??0.9);
  };
}
