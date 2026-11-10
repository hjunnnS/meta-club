// Three annular bands, one draw call. Tile gaps reveal the approved original floor.
export function rhythmFloor(B, scene) {
  const mesh = B.MeshBuilder.CreateGround('dance floor keys', { width: 16.6, height: 16.6 }, scene);
  mesh.position.y = 0.042;
  mesh.isPickable = false;
  const material = new B.ShaderMaterial('rhythm tiles', scene, {
    vertexSource: 'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec2 p; void main(){p=position.xz;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource: `precision highp float;
      varying vec2 p; uniform float beat; uniform float intensity; uniform float celebration; uniform float accent; uniform float release;
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
        if(release>=0.){
          float front=mix(8.,27.,release);
          float wave=1.-smoothstep(.3,2.1,abs(length(p-vec2(0.,-17.))-front));
          color=mix(color,vec3(1.,.69,.36),wave);
          lit=max(lit,wave);
        }
        gl_FragColor=vec4(mix(vec3(.12,.12,.24),color,lit),intensity*(.18+.82*lit));
      }`
  }, { attributes:['position'], uniforms:['worldViewProjection','beat','intensity','celebration','accent','release'], needAlphaBlending:true });
  material.backFaceCulling = false;
  mesh.material = material;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  return (beat, celebrating, accent, release) => {
    material.setFloat('release', release);
    material.setFloat('accent', accent);
    material.setFloat('celebration', celebrating ? 1 : 0);
    material.setFloat('beat', beat);
    material.setFloat('intensity', calm.matches ? 0.42 : 0.9);
  };
}
