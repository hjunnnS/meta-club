import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(root+'dance/package.json'),B=require('babylonjs');
const {planWalk}=await import(root+'app/public/click-walk.js');
const {edmSeats,permittedPath,edmStairRoute,edmUpperRoute}=await import(root+'app/edm-layout.js');
const engine=new B.NullEngine(),scene=new B.Scene(engine);scene.useRightHandedSystem=true;
try{
 const bytes=readFileSync(root+'stage/festival/edm-festival.glb');
 const size=bytes.readUInt32LE(12),asset=JSON.parse(bytes.subarray(20,20+size).toString()),bin=28+size;
 const components={5126:[4,'getFloat32'],5125:[4,'getUint32'],5123:[2,'getUint16']};
 const values=id=>{const a=asset.accessors[id],v=asset.bufferViews[a.bufferView],n={VEC3:3,VEC2:2,SCALAR:1}[a.type],size=components[a.componentType][0],view=new DataView(bytes.buffer,bytes.byteOffset+bin+(v.byteOffset||0)+(a.byteOffset||0)),out=[];for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)out.push(view[components[a.componentType][1]](i*(v.byteStride||n*size)+k*size,true));return out;};
 const nodes=asset.nodes.map(n=>{const mesh=new B.Mesh(n.name||'',scene);if(n.mesh!==undefined){const p=asset.meshes[n.mesh].primitives[0],data=new B.VertexData();data.positions=values(p.attributes.POSITION);data.indices=p.indices===undefined?Array.from({length:data.positions.length/3},(_,i)=>i):values(p.indices);data.applyToMesh(mesh);}if(n.translation)mesh.position=B.Vector3.FromArray(n.translation);if(n.rotation)mesh.rotationQuaternion=B.Quaternion.FromArray(n.rotation);if(n.scale)mesh.scaling=B.Vector3.FromArray(n.scale);if(n.matrix){const scale=new B.Vector3(),rotation=new B.Quaternion(),position=new B.Vector3();B.Matrix.FromArray(n.matrix).decompose(scale,rotation,position);mesh.scaling=scale;mesh.rotationQuaternion=rotation;mesh.position=position;}return mesh;});
 asset.nodes.forEach((n,i)=>{for(const child of n.children||[])nodes[child].parent=nodes[i];});
 for(const mesh of scene.meshes)mesh.computeWorldMatrix(true);
 const html=readFileSync(root+'stage/festival/index.html','utf8');
 const classify=html.slice(html.indexOf(' const floors=new Set()'),html.indexOf(' const walker=new B.Mesh'));
 const {floors}=new Function('scene',classify+';return {floors};')(scene);
 const source=html.slice(html.indexOf(' function navigate('),html.indexOf(' function pointAt('));
 const podiumEdge=(x,z,foot)=>foot<.8&&Math.abs(x+15.3)<2.1&&[-8.8,-1.6].some(cz=>Math.abs(z-cz)<2.1);
 function navigateRoute(from,points){
  let at={...from},total=0;
  for(const goal of points){
   const eyeHeight=1.65,cam={position:{y:at.y+eyeHeight}},walker={position:{x:at.x,z:at.z}};
   const nav=new Function('B','scene','floors','cam','walker','planWalk','podiumEdge','eyeHeight',`let seated=false,walkRoute=[],walkArrival=null;const down=new B.Vector3(0,-1,0);function cancelWalk(){walkRoute=[];} ${source};return {navigate,route:()=>walkRoute};`)(B,scene,floors,cam,walker,planWalk,podiumEdge,eyeHeight);
   const started=performance.now(),ok=nav.navigate(goal,null,(a,b)=>permittedPath(a,b,['OPEN','OPEN']));
   console.log(JSON.stringify({from:at,to:goal,ok,ms:Math.round(performance.now()-started),steps:nav.route().length}));
   assert(ok,'Map route unavailable');const route=nav.route();at=route.at(-1)||goal;total+=route.length;
  }
  return total;
 }
 const seat=edmSeats.find(s=>s.table===1);
 navigateRoute({x:-1.8,y:.018,z:6.4},[{x:14.8,y:0,z:6.4},{x:14.8,y:0,z:seat.exit.z},seat.exit]);
 const upper=edmSeats.find(s=>s.balcony),from={x:16.6,y:0,z:16.6},ascent=edmStairRoute(from,1);
 navigateRoute(from,[...ascent,...edmUpperRoute(ascent.at(-1),upper.area),upper.exit]);
 console.log('Real GLB ground-table and upper-sofa routes passed.');
}finally{scene.dispose();engine.dispose();}
