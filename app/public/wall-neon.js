// A quiet architectural line and the actual audible waveform, in one wall mesh.
export function wallNeon(B,scene) {
  const mesh=new B.Mesh('Purple pink wall waveform',scene),data=new B.VertexData();
  const positions=[],uvs=[],indices=[];
  const panels=[
    [[-21.12,-20],[-21.12,20]],[[21.12,-20],[21.12,20]],
    [[-20,20.32],[-10.2,20.32]],[[10.2,20.32],[20,20.32]],
    [[-19,-20.92],[-10,-20.92]],[[10,-20.92],[19,-20.92]],
  ];
  for(const [a,b] of panels){
    const base=positions.length/3;
    positions.push(a[0],2.3,a[1],b[0],2.3,b[1],b[0],3.5,b[1],a[0],3.5,a[1]);
    uvs.push(0,0,1,0,1,1,0,1);indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  data.positions=positions;data.uvs=uvs;data.indices=indices;data.normals=[];
  B.VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);
  mesh.isPickable=false;
  const ink=new B.ShaderMaterial('Restrained magenta wall neon',scene,{
    vertexSource:'precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 worldViewProjection;varying vec2 vUV;void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.);}',
    fragmentSource:`precision highp float;varying vec2 vUV;uniform float wave[64];uniform float intensity;
      void main(){
        float index=clamp(vUV.x*63.,0.,63.);int a=int(floor(index));int b=a<63?a+1:63;
        float signal=mix(wave[a],wave[b],fract(index));
        float d=abs(vUV.y-.5-signal*.40);
        float core=1.-smoothstep(.014,.040,d);
        float halo=exp(-d*45.)*.22;
        float base=(1.-smoothstep(.006,.018,abs(vUV.y-.5)))*.28;
        vec3 color=mix(vec3(.57,.13,.97),vec3(.98,.15,.61),.5+.5*sin(vUV.x*6.283185));
        float alpha=clamp(core*.62+halo+base,0.,.78)*intensity;
        gl_FragColor=vec4(color*.80,alpha);
      }`
  },{attributes:['position','uv'],uniforms:['worldViewProjection','wave','intensity'],needAlphaBlending:true});
  ink.backFaceCulling=false;mesh.material=ink;
  // Own soft fringe only: global bloom must not compete with the DJ screen.
  for(const layer of scene.effectLayers||[])if(typeof layer.addExcludedMesh==='function')layer.addExcludedMesh(mesh);
  const calm=matchMedia('(prefers-reduced-motion: reduce)'),smooth=new Float32Array(64);
  return (samples,dim=false)=>{
    const blend=1-Math.exp(-Math.min(100,scene.getEngine().getDeltaTime())/24);
    for(let i=0;i<64;i++)smooth[i]+=((calm.matches?0:samples[i]||0)-smooth[i])*blend;
    ink.setFloats('wave',smooth);ink.setFloat('intensity',dim?.25:.90);
  };
}
