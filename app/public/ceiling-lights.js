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
