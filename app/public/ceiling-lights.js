import {strobeSchedule,strobeDurations} from '../../stage/festival/events.js';
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
    ring.position.set(0,6.35+i*.26,-1.2);
    for(let j=0;j<8;j++) {
      const start=j*Math.PI/4, radius=2.9+i*.46;
      const path=Array.from({length:9},(_,k)=>new B.Vector3(radius*Math.cos(start+k*.045),0,radius*Math.sin(start+k*.045)));
      const tube=B.MeshBuilder.CreateTube('ceiling ring arc',{path,radius:.035,tessellation:5,cap:B.Mesh.NO_CAP},scene);
      tube.parent=ring;tube.material=materials[i];tube.isPickable=false;
      arcs.push(tube);
    }
    return {ring,arcs};
  });
  const calm=matchMedia('(prefers-reduced-motion: reduce)');
  return (beat,strobing,energy=0,roomPulse=0,look=null) => {
    rig.setEnabled(!strobing);
    const accent=calm.matches?0:Math.exp(-(((beat%1)+1)%1)*7)*energy;
    if(outerHalo?.emissiveColor){
      const tone=look?B.Color3.FromHexString(look.primary):colors[Math.floor(Math.max(0,beat)/8)%3];
      tone.scaleToRef(strobing?.08:.35+.65*energy+accent*.8+roomPulse,outerHalo.emissiveColor);
    }
    rings.forEach(({ring,arcs},i)=>{
      const phase=((beat%32)+32)%32;
      const hit=!calm.matches&&beat>=32&&phase<4?Math.sin(phase*Math.PI)*Math.exp(-phase*.9)*energy:0;
      ring.position.y=6.35+i*.26-hit*.24;
      ring.rotation.z=hit*.08*(i%2?-1:1);
      ring.rotation.x=hit*.035;
      ring.rotation.y=calm.matches?0:beat*.10*(i%2?-1:1);
      if(look)materials[i].emissiveColor.copyFrom(B.Color3.FromHexString(i%2?look.secondary:look.primary));
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
  const downbeat=Number.isFinite(beat)&&((Math.floor(beat)%4)+4)%4===0;
  // Exaggerate the short outward stroke so it reads from the dance floor.
  // The cabinet and collision footprint remain fixed; only the diaphragm travels.
  return {level,travel:reduced?0:level*(.02+.25*Math.exp(-phase*6.5)),
    light:.12+level*(reduced?.24:.12+(downbeat?6:4)*Math.exp(-Math.max(0,phase-.08)*6))};
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
  const palette=['#12dcff','#ff207b','#923bff'].map(hex=>B.Color3.FromHexString(hex));
  let previous=0;
  scene.onDisposeObservable.addOnce(()=>ink.forEach(m=>m.dispose()));
  return (beat,bands,playing,dt,reduced=false)=>{
    const state=speakerPulse(beat,bands,playing,dt,previous,reduced);
    previous=state.level;
    cones.forEach(({mesh,x})=>mesh.position.x=x+state.travel);
    // Clearly separated cyan, pink and violet looks, one color per two music beats.
    const index=playing&&bands.length>=3&&Number.isFinite(beat)?((Math.floor(beat/2)%3)+3)%3:0;
    const color=palette[index];
    strips.forEach(material=>color.scaleToRef(state.light,material.emissiveColor));
  };
}

export const accentDurations={curtain:strobeDurations.normal,fan:strobeDurations.transition,gobo:strobeDurations.normal};
export function strobeAccentCue({beat,bpm=120,playing=false,preview=null,strobePreview=null,
  overlap=false,protectSmoke=false,reduced=false,arrangement=1}) {
  const off={curtain:0,fan:0,gobo:0,variant:0,travel:0};
  const manual=Boolean(preview||strobePreview);
  if(!manual&&(!playing||!Number.isFinite(beat)||beat<0))return off;
  const safeBeat=Number.isFinite(beat)?Math.max(0,beat):0;
  const cycle=Math.floor(safeBeat/32),section=Math.floor(safeBeat%32/8);
  // Six phrase orders, rather than the same curtain/fan/gobo sequence each time.
  const orders=[[0,1,2,3],[2,0,3,1],[1,3,0,2],[3,2,1,0],[0,3,1,2],[2,1,3,0]];
  const variant=orders[cycle%orders.length][section];
  const beds=[{curtain:.34,fan:.13,gobo:.53},{curtain:.18,fan:.40,gobo:.42},
    {curtain:.27,fan:.20,gobo:.70},{curtain:.40,fan:.27,gobo:.46}];
  const bed=manual?off:beds[variant];
  const gain=(overlap?.56:1)*(reduced?.38:1)*(.72+.28*Math.max(0,Math.min(1,arrangement)));
  const base={curtain:protectSmoke?0:bed.curtain*gain,fan:protectSmoke?0:bed.fan*gain,gobo:bed.gobo*gain};
  let age,duration,look;
  if(preview&&Object.hasOwn(accentDurations,preview.kind)){
    age=preview.age;duration=accentDurations[preview.kind];look=preview.kind;
  }else{
    const timing=strobeSchedule(safeBeat,bpm),kind=strobePreview?.kind||timing.kind;
    if(!Object.hasOwn(strobeDurations,kind))return off;
    age=strobePreview?.age??timing.elapsed;duration=strobeDurations[kind];
    look=kind==='transition'?['fan','mixed','gobo','curtain'][variant]:['curtain','gobo','mixed','fan'][variant];
  }
  const travel=Number.isFinite(age)?Math.max(0,Math.min(1,age/duration)):0;
  if(!Number.isFinite(age)||age<0||age>=duration||(!manual&&arrangement<.55))return {...base,variant,travel:0};
  const envelope=Math.min(1,preview?1:age/.30,(duration-age)/.65);
  const level=envelope*(overlap?.60:1)*(reduced?.30:1);
  // Hand the long accent between existing rigs; never increase the flash rate.
  const handoff=.5-.5*Math.cos(travel*Math.PI*2);
  const accentVariant=(variant+(reduced?0:Math.floor(travel*3)))%4;
  return {curtain:protectSmoke?0:Math.max(base.curtain,level*(look==='curtain'?1-.32*handoff:look==='mixed'?.65:0)),
    fan:protectSmoke?0:Math.max(base.fan,level*(look==='fan'?1-.30*handoff:look==='mixed'?.30:0)),
    gobo:Math.max(base.gobo,level*(look==='gobo'?1:look==='mixed'?.72:.22+.40*handoff)),variant:accentVariant,travel};
}

function goboTextures(B,scene) {
  return [0,1,2].map(kind=>{
    const size=128,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5-size/2)/(size/2),v=(y+.5-size/2)/(size/2);
      const r=Math.hypot(u,v),angle=Math.atan2(v,u),offset=(y*size+x)*4;
      const grid=t=>Math.abs(t-Math.round(t))<.06;
      const mark=kind===0?(Math.abs(r-.76)<.030||Math.abs(r-.44)<.024||r>.2&&r<.87&&Math.abs(Math.sin(angle*8))<.08)
        :kind===1?(grid(u*4)||grid(v*4))
        :(Math.abs(r-.67)<.0325&&Math.cos(angle*12)>.35||Math.abs(r-.30)<.0125);
      pixels[offset]=pixels[offset+1]=pixels[offset+2]=255;
      pixels[offset+3]=r<.94&&mark?Math.round(255*Math.min(1,(.94-r)/.08)):0;
    }
    const texture=B.RawTexture.CreateRGBATexture(pixels,size,size,scene,false,false,B.Texture.BILINEAR_SAMPLINGMODE);
    texture.hasAlpha=true;texture.wrapU=texture.wrapV=B.Texture.CLAMP_ADDRESSMODE;
    return texture;
  });
}
export function strobeAccents(B,scene) {
  const root=new B.TransformNode('Strobe accompaniment',scene);
  const rigs=Object.fromEntries(['curtain','fan','gobo'].map(kind=>{
    const rig=new B.TransformNode('Strobe '+kind,scene);rig.parent=root;rig.setEnabled(false);return [kind,rig];
  }));
  const ink=(name,color)=>{
    const material=new B.StandardMaterial(name,scene);material.disableLighting=true;
    material.emissiveColor=B.Color3.FromHexString(color);material.alphaMode=B.Engine.ALPHA_ADD;
    material.backFaceCulling=false;material.disableDepthWrite=true;return material;
  };
  const curtainInk=[ink('Curtain white','#f5fbff'),ink('Curtain yellow','#ffe56d')];
  const fanInk=ink('Overhead fan ice','#ddf5ff'),fanSheetInk=ink('Overhead fan luminous sheet','#92ddff');
  const curtains=[],fans=[],fanSheets=[],patterns=[],textures=goboTextures(B,scene);
  function ray(name,rig,material,diameter=.019){
    const mesh=B.MeshBuilder.CreateCylinder(name,{height:1,diameter,tessellation:5,cap:B.Mesh.NO_CAP},scene);
    mesh.parent=rig;mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;mesh.rotationQuaternion=new B.Quaternion();return mesh;
  }
  for(const side of [-1,1])for(const z of [-14,-8,-2,4,10,16])for(const i of [-1,0,1]){
    const origin=new B.Vector3(side*20.85,7.05,z);
    curtains.push({mesh:ray('Strobe wall curtain beam',rigs.curtain,curtainInk[side<0?0:1]),side,z,i,origin});
  }
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const origin=new B.Vector3(side*10.8,7.1,-16.7);
    fans.push({mesh:ray('Strobe overhead fan beam',rigs.fan,fanInk,.0425),origin,side,i});
  }
  for(const side of [-1,1]){
    const mesh=new B.Mesh('Strobe overhead fan light sheet',scene),vertices=new Float32Array(9);
    const data=new B.VertexData();data.positions=Array.from(vertices);data.indices=[0,1,2];data.normals=[0,1,0,0,1,0,0,1,0];data.applyToMesh(mesh,true);
    mesh.parent=rigs.fan;mesh.material=fanSheetInk;mesh.isPickable=false;mesh.checkCollisions=false;
    fanSheets.push({mesh,vertices,side});
  }
  for(const [i,[x,z]] of [[-9.4,6],[9.4,6]].entries()){
    const material=ink('Strobe floor pattern '+i,i?'#ffe27a':'#f3fbff');
    const mesh=B.MeshBuilder.CreateGround('Strobe gobo floor',{width:7.2,height:7.2},scene);
    mesh.position.set(x,.075,z);mesh.parent=rigs.gobo;mesh.material=material;
    mesh.isPickable=false;mesh.checkCollisions=false;material.emissiveColor.scaleInPlace(1.6);material.opacityTexture=textures[0];
    patterns.push({mesh,material,wall:false,sign:i?1:-1});
  }
  for(const side of [-1,1]){
    const material=ink('Strobe wall pattern '+side,side<0?'#75dbff':'#f1f9ff');
    const mesh=B.MeshBuilder.CreatePlane('Strobe gobo wall',{size:4.8,sideOrientation:B.Mesh.DOUBLESIDE},scene);
    mesh.parent=rigs.gobo;mesh.position.set(side*21.12,5.05,6);mesh.rotation.y=side*Math.PI/2;
    mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;material.emissiveColor.scaleInPlace(1.6);material.opacityTexture=textures[0];
    patterns.push({mesh,material,wall:true,sign:side});
  }
  const delta=new B.Vector3(),destination=new B.Vector3();
  function aim(mesh,origin,target){
    delta.copyFrom(target).subtractInPlace(origin);
    mesh.position.copyFrom(origin).addInPlace(delta.scale(.5));mesh.scaling.y=delta.length();
    B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),mesh.rotationQuaternion);
  }
  const levels={curtain:0,fan:0,gobo:0};
  let centerClearance=0,gatherLevel=0;
  const palettes=[['#8edbff','#f5fbff'],['#f5fbff','#ffe56d'],['#ffe56d','#8edbff'],['#8edbff','#ffe56d']].map(pair=>pair.map(B.Color3.FromHexString));
  return (target,beat,bass=0,reduced=false,dt=null,protectCenter=false)=>{
    const blend=dt===null?1:1-Math.exp(-Math.max(0,Math.min(dt,1000))/220);
    for(const kind of ['curtain','fan','gobo'])levels[kind]+=(target[kind]-levels[kind])*blend;
    centerClearance+=((protectCenter?1:0)-centerClearance)*blend;
    gatherLevel+=((reduced?0:target.gather||0)-gatherLevel)*blend;
    const cue=levels;
    for(const kind of ['curtain','fan','gobo'])rigs[kind].setEnabled(cue[kind]>.001);
    const motion=reduced?0:beat;
    const variant=target.variant||0,travel=target.travel||0;
    const hit=reduced?0:Math.exp(-(((beat%1)+1)%1)*6)*Math.max(0,Math.min(1,bass));
    curtainInk.forEach((material,i)=>{
      B.Color3.LerpToRef(material.emissiveColor,palettes[variant][i],blend,material.emissiveColor);
      material.alpha=cue.curtain*(.48+hit*.38)*(reduced?.65:.76+.24*Math.sin(beat*Math.PI+i*Math.PI)**2);
    });
    B.Color3.LerpToRef(fanInk.emissiveColor,palettes[variant][0],blend,fanInk.emissiveColor);
    fanInk.alpha=cue.fan*(.70+hit*.22);fanSheetInk.alpha=cue.fan*(.065+hit*.035)*(1-.88*centerClearance);
    if(cue.curtain)for(const {mesh,origin,side,z,i} of curtains){
      const chase=reduced?1:.35+.65*(.5+.5*Math.cos(motion*Math.PI/2-z*.24-side*variant));
      mesh.visibility=chase;
      destination.set(side*(18.75+.95*Math.sin(motion*.40+z*.12+variant)),.36,z+i*.65+Math.sin(motion*.5+side)*1.8);
      destination.z+=(-9.5-destination.z)*gatherLevel;
      aim(mesh,origin,destination);
    }
    if(cue.fan)for(const {mesh,origin,side,i} of fans){
      mesh.visibility=reduced?.65:.45+.55*(.5+.5*Math.cos(motion*Math.PI/4-i*.45+side*variant));
      const spread=.55+.45*(.5+.5*Math.sin(motion*Math.PI/8+variant+travel));
      const originalX=side*(11.2+i*.78*spread),edgeX=side*(12+i*.72);
      destination.set(originalX+(edgeX-originalX)*centerClearance,3.5+Math.abs(i-4)*.20,15-1.4*Math.sin(motion*.18));
      destination.z+=(-10.8-destination.z)*gatherLevel;
      aim(mesh,origin,destination);
    }
    if(cue.fan)for(const {mesh,vertices,side} of fanSheets){
      const spread=.55+.45*(.5+.5*Math.sin(motion*Math.PI/8)),baseZ=15-1.4*Math.sin(motion*.18),z=baseZ+(-10.8-baseZ)*gatherLevel;
      const left=side*11.2,right=side*(11.2+6.2*spread);
      vertices.set([side*10.8,7.1,-16.7,left+(side*10-left)*centerClearance,4.3,z,right+(side*16-right)*centerClearance,4.3,z]);
      mesh.updateVerticesData(B.VertexBuffer.PositionKind,vertices,true);
    }
    for(const {mesh,material,wall,sign} of patterns){
      B.Color3.LerpToRef(material.emissiveColor,palettes[variant][sign<0?0:1].scale(1.6),blend,material.emissiveColor);
      material.alpha=cue.gobo*(.65+hit*.22);material.opacityTexture=textures[((Math.floor(Math.max(0,beat)/8)+variant)%3+3)%3];
      if(wall){
        mesh.rotation.z=motion*.10*sign;
        mesh.position.y=5.05+.55*Math.sin(motion*.13+sign);
        mesh.position.z=6+3.4*Math.sin(motion*.10+sign*.7);
        mesh.position.z+=(-9.5-mesh.position.z)*gatherLevel;
      }else{
        mesh.rotation.y=motion*.10*sign;
        mesh.position.x=sign*(9.4+1.2*Math.sin(motion*.16));
        mesh.position.z=6+2.6*Math.sin(motion*.12+sign*.6);
        mesh.position.z+=(-7.5-mesh.position.z)*gatherLevel;
      }
    }
  };
}
