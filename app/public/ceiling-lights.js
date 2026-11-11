// Thin light segments follow the existing truss and leave the stage sightline open.
export function ceilingLights(B, scene) {
  const rig = new B.TransformNode('ceiling light rings',scene);
  const outerHalo=scene.materials.find(m=>m.name==='Muted violet truss strip');
  const colors=['#64dfff','#ef84ff','#ffcb83'].map(B.Color3.FromHexString);
  const materials = ['#64dfff','#ef84ff','#ffcb83'].map(hex => {
    const material = new B.StandardMaterial('ceiling ring color',scene);
    material.disableLighting = true;
    material.emissiveColor = B.Color3.FromHexString(hex);
    material.alpha = .50;
    return material;
  });
  const rings = [0,1,2].map(i => {
    const arcs=[];
    const ring = new B.TransformNode('rotating ceiling ring',scene);
    ring.parent=rig;
    ring.position.set(0,7.65+i*.24,1);
    for(let j=0;j<8;j++) {
      const start=j*Math.PI/4, radius=5.7+i*.55;
      const path=Array.from({length:9},(_,k)=>new B.Vector3(radius*Math.cos(start+k*.045),0,radius*Math.sin(start+k*.045)));
      const tube=B.MeshBuilder.CreateTube('ceiling ring arc',{path,radius:.055,tessellation:5,cap:B.Mesh.NO_CAP},scene);
      tube.parent=ring;tube.material=materials[i];tube.isPickable=false;
      arcs.push(tube);
    }
    return {ring,arcs};
  });
  const calm=matchMedia('(prefers-reduced-motion: reduce)');
  return (beat,strobing,energy=0,roomPulse=0) => {
    rig.setEnabled(!strobing);
    const accent=calm.matches?0:Math.exp(-(((beat%1)+1)%1)*7)*energy;
    if(outerHalo?.emissiveColor){
      const tone=colors[Math.floor(Math.max(0,beat)/8)%3];
      tone.scaleToRef(strobing?.08:.35+.65*energy+accent*.8+roomPulse,outerHalo.emissiveColor);
    }
    rings.forEach(({ring,arcs},i)=>{
      const phase=((beat%32)+32)%32;
      const hit=!calm.matches&&beat>=32&&phase<4?Math.sin(phase*Math.PI)*Math.exp(-phase*.9)*energy:0;
      ring.position.y=7.65+i*.24-hit*.48;
      ring.rotation.z=hit*.16*(i%2?-1:1);
      ring.rotation.x=hit*.06;
      ring.rotation.y=calm.matches?0:beat*.10*(i%2?-1:1);
      materials[i].alpha=calm.matches?.5:Math.min(1,.50+accent*.35+roomPulse*.25);
      arcs.forEach((arc,j)=>{arc.visibility=calm.matches?.65:(j===((Math.floor(beat*2)+i)%8+8)%8?1:.35);});
    });
  };
}

// Actual low-frequency analyser bands gate the accent; the song beat shapes each hit.
export function speakerPulse(beat,bands,playing,dt,previous=0,reduced=false) {
  if(!playing||bands.length<3)return {level:0,travel:0,light:.12};
  const bass=bands.slice(0,3).reduce((n,v)=>n+(Number.isFinite(v)?Math.max(0,Math.min(1,v)):0),0)/3;
  const target=Math.sqrt(Math.max(0,(bass-.025)/.975));
  const elapsed=Math.max(0,Math.min(100,Number.isFinite(dt)?dt:16));
  const blend=1-Math.exp(-elapsed/(target>previous?20:95));
  const level=previous+(target-previous)*blend;
  const phase=Number.isFinite(beat)?((beat%1)+1)%1:0;
  const hit=Math.exp(-phase*9);
  const downbeat=Number.isFinite(beat)&&((Math.floor(beat)%4)+4)%4===0;
  // Exaggerate the short outward stroke so it reads from the dance floor.
  // The cabinet and collision footprint remain fixed; only the diaphragm travels.
  return {level,travel:reduced?0:level*(.02+.25*Math.exp(-phase*6.5)),
    light:.12+level*(reduced?.24:.22+(downbeat?2.8:1.8)*hit)};
}
export function musicSpeakers(B,scene) {
  const cones=[],strips=[],ink=[];
  for(const mesh of scene.meshes) {
    if(!mesh.getTotalVertices())continue;
    const names=[mesh.name,mesh.parent?.name];
    if(names.some(n=>n==='West speaker woofer'||n==='West speaker dust cap'))
      cones.push({mesh,x:mesh.position.x});
    if(names.some(n=>n==='West speaker trim')&&mesh.material?.name==='Ice LED') {
      const material=mesh.material.clone('Music-reactive speaker edge');
      mesh.material=material;ink.push(material);strips.push(material);
    }
  }
  const cyan=B.Color3.FromHexString('#55e4f5'),rose=B.Color3.FromHexString('#b75dff');
  let previous=0;
  scene.onDisposeObservable.addOnce(()=>ink.forEach(m=>m.dispose()));
  return (beat,bands,playing,dt,reduced=false)=>{
    const state=speakerPulse(beat,bands,playing,dt,previous,reduced);
    previous=state.level;
    cones.forEach(({mesh,x})=>mesh.position.x=x+state.travel);
    const color=B.Color3.Lerp(cyan,rose,Number.isFinite(beat)?(.5+.5*Math.sin(beat*Math.PI/8))*.45:0);
    strips.forEach(material=>color.scaleToRef(state.light,material.emissiveColor));
  };
}
