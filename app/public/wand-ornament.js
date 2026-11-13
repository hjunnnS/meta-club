// Small original meshes; all are visual only and share the owning wand's ink.
export function wandOrnament(B,scene,parent,kind,material){
  if(kind==='none')return null;
  const root=new B.TransformNode('wand ornament '+kind,scene);root.parent=parent;root.rotation.z=Math.PI;
  function part(mesh,x,y,z){mesh.parent=root;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=false;return mesh;}
  if(kind==='star'){
    const positions=[0,0,0],indices=[];
    for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.065:.15;positions.push(Math.cos(a)*r,Math.sin(a)*r,0);}
    for(let i=0;i<10;i++)indices.push(0,1+i,1+(i+1)%10,0,1+(i+1)%10,1+i);
    const mesh=new B.Mesh('wand star',scene),data=new B.VertexData();data.positions=positions;data.indices=indices;
    data.normals=new Array(positions.length).fill(0);B.VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);part(mesh,0,0,0);
  }else if(kind==='heart'){
    for(const side of [-1,1])part(B.MeshBuilder.CreateSphere('wand heart lobe',{diameter:.16,segments:8},scene),side*.055,.035,0);
    const point=part(B.MeshBuilder.CreateBox('wand heart point',{size:.145},scene),0,-.035,0);point.scaling.z=.48;point.rotation.z=Math.PI/4;
  }else if(kind==='crown'){
    part(B.MeshBuilder.CreateBox('wand crown band',{width:.27,height:.065,depth:.07},scene),0,-.07,0);
    for(const [x,h]of [[-.10,.16],[0,.23],[.10,.16]])part(B.MeshBuilder.CreateCylinder('wand crown peak',{diameterBottom:.075,diameterTop:0,height:h,tessellation:4},scene),x,h/2-.04,0);
  }
  return root;
}
