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
    const segments=Array.from({length:18},(_,i)=>oval('dragon coil',body,0,0,0,1-i*.025,.95-i*.025,1.1));
    const head=new B.TransformNode('dragon head',scene); head.parent=body;
    oval('dragon skull',head,0,0,0,1.45,1.1,1.65);
    oval('dragon snout',head,0,-.18,.9,.9,.55,1.2);
    for(const side of [-1,1]) {
      blade(head,[side*.3,.3,-.4],[side*1,1.9,-1],[side*.7,.3,-.8]);
      oval('dragon eye',head,side*.59,.25,.62,.18,.18,.18);
    }
    motion=t=>{
      segments.forEach((mesh,i)=>{
        const a=t*.65-i*.29;
        mesh.position.set(3*Math.cos(a),.55*Math.sin(a*2),3*Math.sin(a));
      });
      head.position.copyFrom(segments[0].position);
      head.rotation.y=-t*.65;
      body.rotation.y=t*.15;
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
      const gather=Math.sin(Math.PI*Math.min(1,t/14));
      for(const {butterfly,wings,i} of swarm) {
        const side=i%2?1:-1,a=(i%12)/12*Math.PI*2;
        butterfly.position.set(side*(.7+2.3*Math.abs(Math.sin(a)))*gather+(1-gather)*5*Math.sin(i*2.4+t),
          1.8*Math.cos(a)*gather+(1-gather)*2*Math.cos(i+t),.5*Math.sin(i+t));
        for(const {wing,side:s} of wings)wing.rotation.y=s*.8*Math.sin(t*8+i);
      }
    };
  }
  return t=>{
    const fade=Math.max(.001,Math.min(1,t/1.5,(14-t)/1.5));
    body.scaling.setAll(fade);
    body.position.set(3+1.4*Math.sin(t*.22),(kind==='jellyfish'?5.0:4.0)+.2*Math.sin(t*.7),1+1.2*Math.sin(t*.3));
    motion(t);
  };
}
