import {edmFloor} from '/clubs/edm/edm-layout.js';
// Original procedural holograms. All parts belong to the event root for disposal.
export function hologram(B, scene, root, kind) {
  const colors = {whale:'#4ce4ff', dragon:'#55ffc9', jellyfish:'#d788ff', butterflies:'#ff9edf'};
  const ink = new B.StandardMaterial(kind + ' hologram', scene);
  ink.diffuseColor = B.Color3.FromHexString(colors[kind]);
  ink.emissiveColor = ink.diffuseColor.scale(.5);
  ink.alpha = .58;
  ink.backFaceCulling = false;
  const edge = new B.StandardMaterial(kind + ' outline', scene);
  edge.emissiveColor = ink.diffuseColor;
  edge.disableLighting = true;
  edge.wireframe = true;
  edge.alpha = .15;
  let eyeInk;
  const body = new B.TransformNode(kind + ' flight', scene);
  body.parent = root;
  function oval(name, parent, x,y,z, sx,sy,sz) {
    const mesh = B.MeshBuilder.CreateSphere(name,{diameter:1,segments:12},scene);
    mesh.parent = parent;
    mesh.position.set(x,y,z);
    mesh.scaling.set(sx,sy,sz);
    mesh.material = ink;
    mesh.isPickable = false;
    if (name.endsWith('eye')) {
      if (!eyeInk) {
        eyeInk = new B.StandardMaterial(kind + ' eye', scene);
        eyeInk.diffuseColor = B.Color3.FromHexString('#102a40');
        eyeInk.emissiveColor = eyeInk.diffuseColor.scale(.25);
      }
      mesh.material = eyeInk;
      return mesh;
    }
    const lines = mesh.clone(name+' outline',parent);
    lines.material = edge;
    lines.scaling.scaleInPlace(1.006);
    return mesh;
  }
  function blade(parent, a,b,c) {
    const mesh = new B.Mesh('hologram fin',scene), data = new B.VertexData();
    data.positions = [...a,...b,...c];
    data.indices = [0,1,2];
    data.normals = [];
    B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);
    data.applyToMesh(mesh);
    mesh.parent = parent; mesh.material = ink; mesh.isPickable = false;
    return mesh;
  }
  let motion;
  if (kind === 'whale') {
    oval('whale body',body,0,0,0,3,2.2,7);
    oval('whale head',body,0,.1,2.4,2.8,2,2.4);
    for (const side of [-1,1]) {
      blade(body,[side*.8,-.5,1],[side*3.9,-1,-1.4],[side*1,-.5,-1]);
      blade(body,[0,0,-4.1],[side*2.7,.75,-5.1],[side*.55,0,-3.4]);
      oval('whale eye',body,side*1.3,.3,2.8,.14,.14,.14);
    }
    blade(body,[0,.7,-.5],[0,2,-1.7],[0,.7,-2.2]);
    motion=t=>{body.rotation.x=.09*Math.sin(t*1.6);body.rotation.y=.75+.2*Math.sin(t*.4);};
  } else if (kind === 'dragon') {
    // An open serpentine silhouette, tapered tail and unmistakable dragon head.
    const segments=Array.from({length:26},(_,i)=>{
      const taper=1-i/29;
      const mesh=oval('dragon scaled body',body,0,0,0,.95*taper,.88*taper,.72);
      if(i>1&&i<22)blade(mesh,[0,.37,-.18],[0,1.10,-.40],[0,.38,-.57]);
      return mesh;
    });
    const head=new B.TransformNode('dragon head',scene);head.parent=body;
    oval('dragon skull',head,0,.08,0,1.55,1.15,1.65);
    oval('dragon long muzzle',head,0,-.11,1.0,1.05,.52,1.7);
    oval('dragon lower jaw',head,0,-.43,1.04,.95,.22,1.5);
    function tendril(name,parent,points,radius){
      const mesh=B.MeshBuilder.CreateTube(name,{path:points.map(p=>B.Vector3.FromArray(p)),radius,tessellation:6},scene);
      mesh.parent=parent;mesh.material=ink;mesh.isPickable=false;return mesh;
    }
    for(const side of [-1,1]){
      tendril('dragon antler',head,[[side*.47,.43,-.35],[side*.65,1.22,-.60],[side*1.03,1.78,-1.03]],.075);
      tendril('dragon antler branch',head,[[side*.65,1.22,-.60],[side*1.02,1.30,-.38]],.05);
      oval('dragon brow',head,side*.59,.38,.48,.6,.25,.5);
      oval('dragon eye',head,side*.67,.22,.65,.20,.16,.16);
      blade(head,[side*.25,-.27,1.46],[side*.37,-.73,1.57],[side*.46,-.28,1.18]);
      tendril('dragon flowing whisker',head,[[side*.42,-.03,1.55],[side*1.15,.12,1.75],[side*1.9,.50,1.38],[side*2.2,.70,.85]],.025);
      blade(head,[side*.52,.06,-.48],[side*1.45,.24,-1.38],[side*.57,-.25,-.75]);
      for(const index of [5,13]){
        const leg=new B.TransformNode('dragon leg',scene);leg.parent=segments[index];
        tendril('dragon bent leg',leg,[[side*.30,-.12,0],[side*.90,-.55,.15],[side*.73,-1.0,.55]],.13);
        for(let claw=0;claw<3;claw++)
          tendril('dragon claw',leg,[[side*.73+(claw-1)*.14,-1,.55],[side*.73+(claw-1)*.22,-1.12,.98]],.035);
      }
    }
    motion=t=>{
      segments.forEach((mesh,i)=>{
        const a=t*.85-i*.27;
        mesh.position.set(2.55*Math.sin(a),.65*Math.cos(a*.8),3.5-i*.28);
        mesh.rotation.y=Math.atan2(2.55*(Math.sin(a)-Math.sin(a-.27)),.28);
      });
      head.position.copyFrom(segments[0].position);
      head.rotation.y=segments[0].rotation.y;
      body.rotation.y=.32*Math.sin(t*.3);
    };
  } else if (kind === 'jellyfish') {
    oval('jellyfish bell',body,0,.8,0,4.4,2.6,4.4);
    const threads=Array.from({length:10},(_,i)=>{
      const points=Array.from({length:13},(_,j)=>new B.Vector3(Math.cos(i*Math.PI/5)*1.3,-j*.32,Math.sin(i*Math.PI/5)*1.3));
      const mesh=B.MeshBuilder.CreateTube('jellyfish tentacle',{path:points,radius:.055,tessellation:5,updatable:true},scene);
      mesh.parent=body;mesh.material=ink;mesh.isPickable=false;
      return {mesh,points,i};
    });
    motion=t=>{
      body.scaling.x=body.scaling.z=1+.09*Math.sin(t*2);
      for(const {mesh,points,i} of threads) {
        points.forEach((p,j)=>{p.x=Math.cos(i*Math.PI/5)*1.3+.25*j/3*Math.sin(t*1.7-j*.4+i);p.z=Math.sin(i*Math.PI/5)*1.3+.35*Math.cos(t-j*.5+i);});
        B.MeshBuilder.CreateTube(null,{path:points,instance:mesh});
      }
    };
  } else {
    const swarm=Array.from({length:24},(_,i)=>{
      const butterfly=new B.TransformNode('light butterfly',scene);butterfly.parent=body;
      oval('butterfly body',butterfly,0,0,0,.09,.55,.09);
      const wings=[-1,1].map(side=>{
        const wing=new B.TransformNode('butterfly wing',scene);wing.parent=butterfly;
        oval('upper wing',wing,side*.29,.14,0,.6,.65,.045);
        oval('lower wing',wing,side*.22,-.22,0,.4,.38,.04);
        return {wing,side};
      });
      return {butterfly,wings,i};
    });
    motion=t=>{
      // Emerge as one close cluster; then burst outward in every direction.
      const expansion=Math.max(0,Math.min(1,(t-4)/5.5));
      const spread=expansion*expansion*(3-2*expansion);
      for(const {butterfly,wings,i} of swarm){
        const a=i*2.3999632297,y=1-2*(i+.5)/swarm.length;
        const horizontal=Math.sqrt(1-y*y),radius=.55+spread*(4.7+(i%4)*.24);
        butterfly.position.set(Math.cos(a)*horizontal*radius+.10*Math.sin(t*2+i),
          y*radius*.46+.12*Math.sin(t*1.7+i),Math.sin(a)*horizontal*radius+.10*Math.cos(t*2+i));
        butterfly.rotation.y=a+Math.PI/2;
        butterfly.rotation.z=.15*Math.sin(t*2+i);
        for(const {wing,side:s} of wings)wing.rotation.y=s*.8*Math.sin(t*8+i);
      }
    };
  }
  return t=>{
    const fade=Math.max(.001,Math.min(1,t/1.5,(14-t)/1.5));
    body.scaling.setAll(fade);
    body.position.set(0,(kind==='jellyfish'?5.0:4.0)+.2*Math.sin(t*.7),edmFloor.centerZ);
    motion(t);
  };
}
