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
  const off={curtain:0,fan:0,gobo:0};
  let age,duration,look;
  if(preview&&Object.hasOwn(accentDurations,preview.kind)){
    age=preview.age;duration=accentDurations[preview.kind];look=preview.kind;
  }else{
    if(!Number.isFinite(beat)||beat<0||(!strobePreview&&(!playing||arrangement<.55)))return off;
    const timing=strobeSchedule(beat,bpm),kind=strobePreview?.kind||timing.kind;
    if(!Object.hasOwn(strobeDurations,kind))return off;
    age=strobePreview?.age??timing.elapsed;
    duration=strobeDurations[kind];
    const cycle=Math.floor(beat/32);
    look=kind==='transition'?'fan':['curtain','gobo','mixed'][((cycle%3)+3)%3];
  }
  if(!Number.isFinite(age)||age<0||age>=duration)return off;
  const envelope=Math.min(1,preview?1:age/.30,(duration-age)/.65);
  const level=envelope*(overlap?.24:1)*(reduced?.30:1);
  return {curtain:protectSmoke?0:level*(look==='curtain'?1:look==='mixed'?.55:0),
    fan:protectSmoke?0:level*(look==='fan'?1:0),
    gobo:level*(look==='gobo'?1:look==='mixed'?.65:look==='fan'?.28:0)};
}

function goboTextures(B,scene) {
  return [0,1,2].map(kind=>{
    const size=128,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5-size/2)/(size/2),v=(y+.5-size/2)/(size/2);
      const r=Math.hypot(u,v),angle=Math.atan2(v,u),offset=(y*size+x)*4;
      const grid=t=>Math.abs(t-Math.round(t))<.055;
      const mark=kind===0?(Math.abs(r-.76)<.027||Math.abs(r-.44)<.022||r>.2&&r<.87&&Math.abs(Math.sin(angle*8))<.10)
        :kind===1?(grid(u*4)||grid(v*4))
        :(Math.abs(r-.67)<.065&&Math.cos(angle*12)>.35||Math.abs(r-.30)<.025);
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
  const curtainInk=[ink('Curtain cyan','#52efff'),ink('Curtain pink','#ee6bff')];
  const fanInk=ink('Overhead fan blue','#9295ff');
  const curtains=[],fans=[],patterns=[],textures=goboTextures(B,scene);
  function ray(name,rig,material){
    const mesh=B.MeshBuilder.CreateCylinder(name,{height:1,diameter:.038,tessellation:5,cap:B.Mesh.NO_CAP},scene);
    mesh.parent=rig;mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;mesh.rotationQuaternion=new B.Quaternion();return mesh;
  }
  for(const side of [-1,1])for(const z of [-14,-8,-2,4,10,16])for(const i of [-1,0,1]){
    const origin=new B.Vector3(side*20.85,7.05,z);
    curtains.push({mesh:ray('Strobe wall curtain beam',rigs.curtain,curtainInk[side<0?0:1]),side,z,i,origin});
  }
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const origin=new B.Vector3(side*5.7,7.3,-10.9);
    fans.push({mesh:ray('Strobe overhead fan beam',rigs.fan,fanInk),origin,side,i});
  }
  for(const [i,[x,z]] of [[-4.8,.5],[4.5,-2.2]].entries()){
    const material=ink('Strobe floor pattern '+i,i?'#bd80ff':'#62dcff');
    const mesh=B.MeshBuilder.CreateGround('Strobe gobo floor',{width:5.0,height:5.0},scene);
    mesh.position.set(x,.066,z);mesh.parent=rigs.gobo;mesh.material=material;
    mesh.isPickable=false;mesh.checkCollisions=false;material.opacityTexture=textures[0];
    patterns.push({mesh,material,wall:false,sign:i?1:-1});
  }
  for(const side of [-1,1]){
    const material=ink('Strobe wall pattern '+side,side<0?'#72d9ff':'#dc83ff');
    const mesh=B.MeshBuilder.CreatePlane('Strobe gobo wall',{size:3.6,sideOrientation:B.Mesh.DOUBLESIDE},scene);
    mesh.parent=rigs.gobo;mesh.position.set(side*21.12,5.35,6);mesh.rotation.y=side*Math.PI/2;
    mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;material.opacityTexture=textures[0];
    patterns.push({mesh,material,wall:true,sign:side});
  }
  const delta=new B.Vector3(),destination=new B.Vector3();
  function aim(mesh,origin,target){
    delta.copyFrom(target).subtractInPlace(origin);
    mesh.position.copyFrom(origin).addInPlace(delta.scale(.5));mesh.scaling.y=delta.length();
    B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),mesh.rotationQuaternion);
  }
  return (cue,beat,bass=0,reduced=false)=>{
    for(const kind of ['curtain','fan','gobo'])rigs[kind].setEnabled(cue[kind]>.001);
    const motion=reduced?0:beat;
    const hit=reduced?0:Math.exp(-(((beat%1)+1)%1)*6)*Math.max(0,Math.min(1,bass));
    curtainInk.forEach((material,i)=>material.alpha=cue.curtain*(.35+hit*.38)*(reduced?.65:.68+.32*Math.sin(beat*Math.PI+i*Math.PI)**2));
    fanInk.alpha=cue.fan*(.38+hit*.30);
    if(cue.curtain)for(const {mesh,origin,side,z,i} of curtains){
      destination.set(side*(19.25+.65*Math.sin(motion*.65+z*.12)),.36,z+i*.65+Math.sin(motion*.6)*1.0);
      aim(mesh,origin,destination);
    }
    if(cue.fan)for(const {mesh,origin,side,i} of fans){
      const spread=.55+.45*(.5+.5*Math.sin(motion*Math.PI/8));
      destination.set((i-4)*3.5*spread+side*1.1,4.3+Math.abs(i-4)*.22,16.5-2*Math.sin(motion*.18));
      aim(mesh,origin,destination);
    }
    for(const {mesh,material,wall,sign} of patterns){
      material.alpha=cue.gobo*(.50+hit*.25);material.opacityTexture=textures[((Math.floor(Math.max(0,beat)/4)%3)+3)%3];
      if(wall)mesh.rotation.z=motion*.10*sign;else mesh.rotation.y=motion*.10*sign;
    }
  };
}
