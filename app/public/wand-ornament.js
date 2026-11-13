// Small original meshes; all are visual only and share the owning wand's ink.
export function wandOrnament(B,scene,parent,kind,material){
  if(kind==='none')return null;
  const root=new B.TransformNode('wand ornament '+kind,scene);root.parent=parent;root.rotation.z=Math.PI;
  function part(mesh,x,y,z){mesh.parent=root;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=false;return mesh;}
  if(kind==='star'){
    part(B.MeshBuilder.CreateSphere('wand rounded star centre',{diameter:.19,segments:12},scene),0,0,0);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;part(B.MeshBuilder.CreateSphere('wand rounded star lobe',{diameter:.105,segments:12},scene),Math.cos(a)*.105,Math.sin(a)*.105,0);}
  }else if(kind==='heart'){
    for(const side of [-1,1])part(B.MeshBuilder.CreateSphere('wand heart lobe',{diameter:.16,segments:8},scene),side*.055,.035,0);
    const point=part(B.MeshBuilder.CreateBox('wand heart point',{size:.145},scene),0,-.035,0);point.scaling.z=.48;point.rotation.z=Math.PI/4;
  }else if(kind==='cloud'){
    for(const [x,y,d]of [[-.10,0,.18],[0,.055,.24],[.12,0,.18],[0,-.045,.22]])part(B.MeshBuilder.CreateSphere('wand cloud lobe',{diameter:d,segments:12},scene),x,y,0);

  }
  return root;
}
