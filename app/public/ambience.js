// Small local glints, never a full-screen flash. One mesh per effect.
export function clubAmbience(B, scene) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const sparkleInk = new B.StandardMaterial('Short pearl glints',scene);
  sparkleInk.disableLighting=true;
  sparkleInk.emissiveColor=new B.Color3(.85,.9,1);
  sparkleInk.backFaceCulling=false;
  const glints=new B.SolidParticleSystem('Room short sparkles',scene);
  const star=new B.Mesh('glint star template',scene);
  const shape=new B.VertexData();
  shape.positions=[0,.34,0,.045,.045,0,.24,0,0,.045,-.045,0,0,-.34,0,-.045,-.045,0,-.24,0,0,-.045,.045,0,0,0,0];
  shape.indices=[];
  for(let i=0;i<8;i++)shape.indices.push(8,i,(i+1)%8);
  shape.normals=[];B.VertexData.ComputeNormals(shape.positions,shape.indices,shape.normals);shape.applyToMesh(star);
  glints.addShape(star,128);star.dispose();
  const sparkleMesh=glints.buildMesh();sparkleMesh.material=sparkleInk;sparkleMesh.isPickable=false;
  glints.billboard=true;
  const noise=(i,s)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  let seconds=0;
  glints.updateParticle=p=>{
    const i=p.idx, angle=noise(i,1)*Math.PI*2;
    const radius=10+noise(i,2)*9;
    p.position.set(Math.cos(angle)*radius,2.5+noise(i,3)*5,Math.sin(angle)*radius);
    const period=2.1+noise(i,4)*3.2;
    const phase=(seconds+noise(i,5)*period)%period;
    const pulse=phase<.24?Math.sin(phase/.24*Math.PI):0;
    p.scaling.setAll(pulse*(.75+noise(i,6)*.65));
    p.rotation.z=noise(i,7)*Math.PI;
    return p;
  };
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
  return (time,values,strobing=false)=>{
    seconds=time;bands=values;
    sparkleMesh.setEnabled(!strobing&&!calm.matches);
    if(sparkleMesh.isEnabled())glints.setParticles();
    bars.setParticles();
  };
}
