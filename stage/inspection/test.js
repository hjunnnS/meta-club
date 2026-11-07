const [type, revision]=location.search.slice(1).split('&');
const canvas=document.querySelector('canvas'),url=revision==='before'?'before.glb':'edm-empty.glb';
canvas.width=innerWidth;canvas.height=innerHeight;
async function script(src){const tag=document.createElement('script');tag.src=src;document.head.append(tag);await new Promise((ok,no)=>{tag.onload=ok;tag.onerror=no;});}
async function load(){
 const bytes=await (await fetch(url)).arrayBuffer(), view=new DataView(bytes);
 const gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))));
 const route=gltf.extras.reviewRoute, names=gltf.meshes.map(m=>m.name);
 let pose,draw,version;
 const bounds={},surfaces=[],triangles=[];
 function geometry(name,points,indices){
  if(!names.includes(name))throw Error('Unexpected mesh: '+name);
  const box=bounds[name]??=[...Array(3).fill(Infinity),...Array(3).fill(-Infinity)];
  for(const p of points) for(let d=0;d<3;d++){box[d]=Math.min(box[d],p[d]);box[3+d]=Math.max(box[3+d],p[d]);}
  for(let i=0;i<indices.length;i+=3){
   const tri=indices.slice(i,i+3).map(k=>points[k]);triangles.push(tri);
   if(['Arena floor','Entry floor','Central stage','North balcony','Balcony ramp','Stage access'].includes(name))surfaces.push(tri);
  }
 }
 if(type==='babylon'){
  await script('node_modules/babylonjs/babylon.js');await script('node_modules/babylonjs-loaders/babylonjs.loaders.min.js');
  const B=BABYLON, engine=new B.Engine(canvas,true), scene=new B.Scene(engine);scene.useRightHandedSystem=true;version=B.Engine.Version;
  const cam=new B.FreeCamera('review',B.Vector3.Zero(),scene);cam.minZ=.05;cam.fov=Math.PI/3;
  scene.clearColor=new B.Color4(.12,.16,.19,1);new B.HemisphericLight('sky',new B.Vector3(-.3,1,.5),scene);
  const loaded=await B.SceneLoader.ImportMeshAsync('', './',url,scene);
  for(const mesh of loaded.meshes){const p=mesh.getVerticesData('position');if(!p)continue;
   const matrix=mesh.computeWorldMatrix(true);const world=[];
   for(let i=0;i<p.length;i+=3)world.push(B.Vector3.TransformCoordinates(B.Vector3.FromArray(p,i),matrix).asArray());
   geometry(names.includes(mesh.name)?mesh.name:mesh.parent?.name,world,Array.from(mesh.getIndices()?.length?mesh.getIndices():world.keys()));
  }
  pose=(p,t)=>{cam.position.set(...p);cam.setTarget(new B.Vector3(...t));return cam.position.asArray();};draw=()=>scene.render();
 }else{
  const pc=await import('./node_modules/playcanvas/build/playcanvas.min.mjs');version=pc.version;
  const app=new pc.Application(canvas);app.setCanvasResolution(pc.RESOLUTION_FIXED,innerWidth,innerHeight);
  app.scene.ambientLight=new pc.Color(.55,.55,.55);const sun=new pc.Entity();sun.addComponent('light',{type:'directional',intensity:1.4});sun.setEulerAngles(55,-35,0);app.root.addChild(sun);
  const cam=new pc.Entity();cam.addComponent('camera',{fov:60,nearClip:.05,clearColor:new pc.Color(.12,.16,.19)});app.root.addChild(cam);
  const asset=await new Promise((ok,no)=>app.assets.loadFromUrl(url,'container',(err,a)=>err?no(err):ok(a)));
  const model=asset.resource.instantiateRenderEntity();app.root.addChild(model);app.root.syncHierarchy();
  for(const r of model.findComponents('render'))for(const mi of r.meshInstances){
   const p=[],idx=[];mi.mesh.getPositions(p);if(mi.mesh.primitive[0].indexed)mi.mesh.getIndices(idx);
   const mat=mi.node.getWorldTransform(),world=[];
   for(let i=0;i<p.length;i+=3){const pt=mat.transformPoint(new pc.Vec3(p[i],p[i+1],p[i+2]));world.push([pt.x,pt.y,pt.z]);}
   geometry(mi.node.name,world,idx.length?idx:Array.from(world.keys()));
  }
  pose=(p,t)=>{cam.setPosition(...p);cam.lookAt(...t);const v=cam.getPosition();return [v.x,v.y,v.z];};draw=()=>app.render();
 }
 if(Object.keys(bounds).length!==names.length)throw Error('Missing meshes');
 function ground(x,z){
  let highest=-Infinity;
  for(const [a,b,c] of surfaces){const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-9)continue;
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
   if(Math.min(u,w,1-u-w)>=-1e-6)highest=Math.max(highest,u*a[1]+w*b[1]+(1-u-w)*c[1]);}
  return highest;
 }
 // Segment intersections at torso and eye height catch vertical walls crossing the route.
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 function crosses(a,b,[v,w,z]){const dir=sub(b,a),e=sub(w,v),f=sub(z,v),p=cross(dir,f),det=dot(e,p);if(Math.abs(det)<1e-10)return false;const s=sub(a,v),u=dot(s,p)/det;if(u<0||u>1)return false;const q=cross(s,e),j=dot(dir,q)/det;if(j<0||j+u>1)return false;const t=dot(f,q)/det;return t>=0&&t<=1;}
 let length=0,worst=0,missing=0,hits=0,samples=0;
 for(let i=1;i<route.length;i++)length+=Math.hypot(...sub(route[i],route[i-1]));
 for(const points of [route,route.slice().reverse()])for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];for(const dy of [0.8,1.65]){const up=p=>[p[0],p[1]+dy,p[2]];if(triangles.some(t=>crosses(up(a),up(b),t)))hits++;}
  for(let k=0;k<=100;k++){const p=a.map((x,d)=>x+(b[d]-x)*k/100),eye=[p[0],p[1]+1.65,p[2]],target=[eye[0]+b[0]-a[0],eye[1]+b[1]-a[1],eye[2]+b[2]-a[2]];
   const actual=pose(eye,target),y=ground(actual[0],actual[2]);samples++;if(!Number.isFinite(y))missing++;else worst=Math.max(worst,Math.abs(actual[1]-1.65-y));}
 }
 const anchors=[route[0],route[4],route.at(-1)].map(([x,y,z])=>[x,ground(x,z),z]);
 // Equal-area stage-top samples. Test sightlines against imported world geometry.
 const eye=[0,5.65,-13];
 const candidates=triangles.filter(tri=>tri.some(p=>p[1]>.801) &&
     tri.some(p=>p[2]>=-13.1) && tri.some(p=>p[2]<=5) &&
     tri.some(p=>p[0]<=5) && tri.some(p=>p[0]>=-5));
 const visible=(x,z)=>!candidates.some(tri=>crosses(eye,[x,.801,z],tri));
 let seen=0;
 const rings=16,sectors=48;
 for(let r=0;r<rings;r++){
   const radius=4.84*Math.sqrt((r+.5)/rings);
   for(let j=0;j<sectors;j++){
     const angle=2*Math.PI*(j+.5)/sectors;
     if(visible(radius*Math.cos(angle),radius*Math.sin(angle)))seen++;
   }
 }
 const visibility={seen,total:rings*sectors,centerVisible:visible(0,0)};
 window.show=(i)=>{const eye=anchors[i].slice();eye[1]+=1.65;pose(eye,i===0?[0,1,0]:i===1?[0,4,-14]:[0,1,0]);draw();};
 window.show(0);
 window.result={type,revision:revision||"after",visibility,version,bounds,anchors,length,worst,missing,hits,samples,meshCount:names.length,triangleCount:triangles.length};
}
load().catch(e=>{window.failure=String(e)+' '+(e.stack||'');});
