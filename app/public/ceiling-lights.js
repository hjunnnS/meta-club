// Thin light segments follow the existing truss and leave the stage sightline open.
export function ceilingLights(B, scene) {
  const rig = new B.TransformNode('ceiling light rings',scene);
  const materials = ['#64dfff','#ef84ff','#ffcb83'].map(hex => {
    const material = new B.StandardMaterial('ceiling ring color',scene);
    material.disableLighting = true;
    material.emissiveColor = B.Color3.FromHexString(hex);
    material.alpha = .50;
    return material;
  });
  const rings = [0,1,2].map(i => {
    const ring = new B.TransformNode('rotating ceiling ring',scene);
    ring.parent=rig;
    ring.position.set(0,7.65+i*.24,1);
    for(let j=0;j<8;j++) {
      const start=j*Math.PI/4, radius=5.7+i*.55;
      const path=Array.from({length:9},(_,k)=>new B.Vector3(radius*Math.cos(start+k*.045),0,radius*Math.sin(start+k*.045)));
      const tube=B.MeshBuilder.CreateTube('ceiling ring arc',{path,radius:.026,tessellation:5,cap:B.Mesh.NO_CAP},scene);
      tube.parent=ring;tube.material=materials[i];tube.isPickable=false;
    }
    return ring;
  });
  const calm=matchMedia('(prefers-reduced-motion: reduce)');
  return (beat,strobing,energy=0) => {
    rig.setEnabled(!strobing);
    rings.forEach((ring,i)=>{
      const phase=((beat%32)+32)%32;
      const hit=!calm.matches&&beat>=32&&phase<4?Math.sin(phase*Math.PI)*Math.exp(-phase*.9)*energy:0;
      ring.position.y=7.65+i*.24-hit*.28;
      ring.rotation.z=hit*.09*(i%2?-1:1);
      ring.rotation.x=hit*.06;
      ring.rotation.y=calm.matches?0:beat*.035*(i%2?-1:1);
      materials[i].alpha=.34+.14*(.5+.5*Math.sin(beat*Math.PI/2+i));
    });
  };
}
