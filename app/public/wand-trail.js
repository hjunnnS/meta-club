// A time-based, rounded centreline trail rather than a broad polygon fan.
export function createWandTrail(B,scene,glow,featured=false){
  const rings=25,sides=8,history=[],meshes=[],materials=[],sparks=[];
  let variant='default',coreColor='#2bd8ff',edgeColor='#102340',sparkInk,scale=1;
  const indices=[];
  for(let i=0;i<rings-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;
    indices.push(a,b,c,b,d,c);
  }
  function tube(name,color,alpha,index,echo=false){
    const mesh=new B.Mesh('rounded wand afterimage '+name,scene);
    const mat=new B.StandardMaterial('rounded wand ink '+name,scene);
    mat.disableLighting=true;mat.emissiveColor=B.Color3.FromHexString(color);
    mat.alpha=alpha;mat.backFaceCulling=false;if(name==='edge')mat.disableDepthWrite=true;
    const positions=new Float32Array(rings*sides*3),normals=new Float32Array(positions.length),colors=new Float32Array(rings*sides*4);
    const data=new B.VertexData();data.positions=positions;data.normals=normals;data.colors=colors;data.indices=indices;
    data.applyToMesh(mesh,true);mesh.material=mat;mesh.isPickable=false;mesh.hasVertexAlpha=true;
    mesh.alphaIndex=index;mesh.visibility=0;glow?.addExcludedMesh(mesh);
    meshes.push({mesh,positions,normals,colors,edge:name==='edge',echo});materials.push(mat);
  }
  tube('edge',edgeColor,.92,1);tube('core',coreColor,.94,2);
  const reset=()=>{history.length=0;for(const {mesh}of meshes)mesh.visibility=0;for(const mesh of sparks)mesh.setEnabled(false);};
  const cat=(p0,p1,p2,p3,t)=>{
    const t2=t*t,t3=t2*t;
    return new B.Vector3(...['x','y','z'].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));
  };
  return {
    reset,
    setPalette(core,edge){
      coreColor=core;edgeColor=edge;
      for(const {mesh,edge:isEdge}of meshes)mesh.material.emissiveColor=B.Color3.FromHexString(isEdge?edge:core);
      if(sparkInk)sparkInk.emissiveColor=B.Color3.FromHexString(core);reset();
    },
    setScale(value){scale=value===1.5?1.5:1;},
    setVariant(next){
      next=['double','sparkles'].includes(next)?next:'default';if(next===variant)return;
      variant=next;reset();
      if(next==='double'&&!meshes.some(m=>m.echo)){tube('edge',edgeColor,.92,1,true);tube('core',coreColor,.94,2,true);}
      if(next==='sparkles'&&!sparks.length){
        sparkInk=new B.StandardMaterial('wand star dust ink',scene);sparkInk.disableLighting=true;sparkInk.emissiveColor=B.Color3.FromHexString(coreColor);materials.push(sparkInk);
        for(let i=0;i<14;i++){const mesh=B.MeshBuilder.CreateSphere('wand star dust',{diameter:.055,segments:4},scene);mesh.material=sparkInk;mesh.isPickable=false;mesh.setEnabled(false);glow?.addExcludedMesh(mesh);sparks.push(mesh);}
      }
    },
    update(point,now,level,reduced,speed){
      if(reduced){reset();return;}
      const last=history.at(-1);
      // Never connect old geometry across a hidden period or a pose discontinuity.
      if(last&&(now-last.time>160||B.Vector3.Distance(last.point,point)>.85))reset();
      history.push({time:now,point:point.clone()});
      while(history.length>2&&history[1].time<now-(180+140*Math.max(0,Math.min(1,level))))history.shift();
      const travel=history.reduce((sum,p,i)=>sum+(i?B.Vector3.Distance(p.point,history[i-1].point):0),0);
      if(history.length<3||travel<.018){for(const {mesh}of meshes)mesh.visibility=0;return;}
      const first=history[0].time,span=Math.max(1,now-first),path=[];
      for(let i=0;i<rings;i++){
        const at=first+span*i/(rings-1);let j=0;
        while(j<history.length-2&&history[j+1].time<at)j++;
        const u=Math.max(0,Math.min(1,(at-history[j].time)/Math.max(1,history[j+1].time-history[j].time)));
        path.push(cat(history[Math.max(0,j-1)].point,history[j].point,history[j+1].point,history[Math.min(history.length-1,j+2)].point,u));
      }
      const radius=((featured?.047:.035)+(featured?.026:.023)*Math.min(1,speed/3.5))*scale;
      for(const record of meshes){
        const {mesh,positions,normals,colors,edge,echo}=record;
        if(echo&&variant!=='double'){mesh.visibility=0;continue;}
        for(let i=0;i<rings;i++){
          const u=i/(rings-1),centre=path[i],tangent=path[Math.min(rings-1,i+1)].subtract(path[Math.max(0,i-1)]).normalize();
          const axis=Math.abs(tangent.y)>.9?B.Axis.X:B.Axis.Y;
          const across=B.Vector3.Cross(tangent,axis).normalize(),up=B.Vector3.Cross(tangent,across).normalize();
          // Both ends close smoothly; the older end also fades in opacity.
          const taper=Math.pow(u,.65)*Math.min(1,(1-u)*6);
          const width=radius*taper*(edge?1.60:1)*(variant==='double'?.62:1),opacity=Math.pow(u,.48);
          const shift=variant==='double'?(echo?-1:1)*.09*scale:0;
          for(let j=0;j<sides;j++){
            const angle=j*Math.PI*2/sides,n=across.scale(Math.cos(angle)).add(up.scale(Math.sin(angle))),v=i*sides+j;
            positions.set([centre.x+across.x*shift+n.x*width,centre.y+across.y*shift+n.y*width,centre.z+across.z*shift+n.z*width],v*3);
            normals.set(n.asArray(),v*3);colors.set([1,1,1,opacity],v*4);
          }
        }
        mesh.updateVerticesData(B.VertexBuffer.PositionKind,positions,true);
        mesh.updateVerticesData(B.VertexBuffer.NormalKind,normals);
        mesh.updateVerticesData(B.VertexBuffer.ColorKind,colors);
        mesh.visibility=Math.min(1,level)*(edge?.92:1);
      }
      for(let i=0;i<sparks.length;i++){const mesh=sparks[i];mesh.setEnabled(variant==='sparkles'&&level>.05);if(variant!=='sparkles')continue;const point=path[Math.floor(i*(rings-1)/sparks.length)],phase=(now/350+i*.23)%1;mesh.position.copyFrom(point);mesh.position.y+=phase*.16;mesh.position.x+=Math.sin(i*2.4)*.045;mesh.scaling.setAll(scale*(.35+1.0*Math.pow(Math.sin(phase*Math.PI),2)));mesh.visibility=level*(1-phase);}
    },
    dispose(){for(const mesh of sparks){glow?.removeExcludedMesh(mesh);mesh.dispose();}for(const {mesh}of meshes){glow?.removeExcludedMesh(mesh);mesh.dispose();}for(const m of materials)m.dispose();history.length=0;},
  };
}
