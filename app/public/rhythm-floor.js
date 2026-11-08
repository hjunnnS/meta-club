// Three annular bands, one draw call. Tile gaps reveal the approved original floor.
export function rhythmFloor(B, scene) {
  const mesh = B.MeshBuilder.CreateGround('dance floor keys', { width: 16.6, height: 16.6 }, scene);
  mesh.position.y = 0.042;
  mesh.isPickable = false;
  const material = new B.ShaderMaterial('rhythm tiles', scene, {
    vertexSource: 'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec2 p; void main(){p=position.xz;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource: `precision highp float;
      varying vec2 p; uniform float beat; uniform float intensity; uniform float celebration;
      void main(){
        float radius=length(p); if(radius>8.2 || radius<0.85) discard;
        float band=(radius-.85)/2.45;
        float slice=(atan(p.y,p.x)+3.141593)*16./6.283185;
        if(fract(band)<.035 || fract(slice)<.026) discard;
        float key=mod(floor(slice)-floor(beat)*2.-floor(band)*2.+64.,8.);
        float wave=exp(-2.*fract(beat))*step(key,1.);
        float chorus=step(12.,mod(beat,16.))*max(0.,1.-abs(floor(band)-mod(beat,4.))*1.6);
        vec3 color=mix(vec3(.09,.73,.84),vec3(.86,.12,.64),floor(band)/2.);
        color=mix(color,vec3(.95,.47,.16),celebration*.65);
        gl_FragColor=vec4(color*(.24+.76*max(wave,chorus)),intensity*(.23+.72*max(wave,chorus)));
      }`
  }, { attributes:['position'], uniforms:['worldViewProjection','beat','intensity','celebration'], needAlphaBlending:true });
  material.backFaceCulling = false;
  mesh.material = material;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  return (beat, celebrating) => {
    material.setFloat('celebration', celebrating ? 1 : 0);
    material.setFloat('beat', beat);
    material.setFloat('intensity', calm.matches ? 0.42 : 0.9);
  };
}
