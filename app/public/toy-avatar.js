// Cosmetic shells only. Shoulder/hip pivots and the 0.525m hand grip remain unchanged.
// Templates share geometry; AI merge their colored details into the original six parts.
const readableMaterials = new WeakSet();
// Bound only visitor materials, leaving every club light, cue and staff material intact.
export function characterMaterial(B, material) {
  if(readableMaterials.has(material))return material;
  readableMaterials.add(material);
  material.specularColor.set(0,0,0);
  class Readability extends B.MaterialPluginBase {
    constructor(){super(material,'CharacterReadability',200,{},true,true);}
    getClassName(){return 'CharacterReadability';}
    isCompatible(language){return language===0;}
    getCustomCode(type,language=0){
      if(type!=='fragment'||language!==0)return null;
      return {CUSTOM_FRAGMENT_BEFORE_FOG:`
        vec3 characterAlbedo=clamp(diffuseColor*baseColor.rgb,vec3(0.0),vec3(1.0));
        float characterFill=0.30+0.12*max(0.0,dot(normalize(normalW),normalize(vec3(0.3,0.8,0.5))));
        color.rgb=clamp(color.rgb,characterAlbedo*characterFill,characterAlbedo*1.10+vec3(0.015));
      `};
    }
  }
  new Readability();
  return material;
}
export function toyAvatarFactory(B, scene) {
  const templates = new Map();
  const dark = new B.StandardMaterial('toy face details', scene);
  dark.diffuseColor = B.Color3.FromHexString('#292333');
  dark.specularColor.set(.05,.05,.05);
  const white = new B.StandardMaterial('toy crowd vertex palette', scene);
  white.diffuseColor = B.Color3.White();
  white.specularColor.set(.08,.08,.08);
  characterMaterial(B,dark);characterMaterial(B,white);
  const skin = '#ddb194', hair = '#604238', shoe = '#a59cb5', sole = '#e5e2eb';
  const color = hex => B.Color3.FromHexString(hex);
  function sphere(w,h,d,x,y,z,ink) {
    return {kind:'CreateSphere',options:{diameter:1,segments:8},scale:[w,h,d],at:[x,y,z],ink};
  }
  function box(w,h,d,x,y,z,ink) {
    return {kind:'CreateBox',options:{width:w,height:h,depth:d},at:[x,y,z],ink};
  }
  function capsule(r,h,x,y,z,ink) {
    return {kind:'CreateCapsule',options:{radius:r,height:h,tessellation:8,subdivisions:1},at:[x,y,z],ink};
  }
  function shell(key,name,parts,parent,material,colored=false) {
    let template=templates.get(key);
    if(!template) {
      const meshes=parts.map(p=>{
        const mesh=B.MeshBuilder[p.kind]('toy shell source',p.options,scene);
        mesh.position.set(...p.at);
        if(p.scale)mesh.scaling.set(...p.scale);
        if(p.rotation)mesh.rotation.set(...p.rotation);
        if(colored){
          const c=color(p.ink),rgba=[];
          for(let i=0;i<mesh.getTotalVertices();i++)rgba.push(c.r,c.g,c.b,1);
          mesh.setVerticesData(B.VertexBuffer.ColorKind,rgba);
        }
        return mesh;
      });
      template=B.Mesh.MergeMeshes(meshes,true,true);
      template.name='toy shared '+key;template.material=material;
      template.isPickable=false;template.checkCollisions=false;
      template.setEnabled(false);templates.set(key,template);
    }
    // Clones share Geometry while retaining independently paintable materials.
    const mesh=template.clone(name,parent,true);
    mesh.setEnabled(true);mesh.isPickable=false;mesh.checkCollisions=false;
    return mesh;
  }
  const faceParts=()=>{
    const parts=[];
    for(const side of [-1,1]){
      parts.push(sphere(.038,.052,.018,side*.064,1.575,.152,'#292333'));
      parts.push(capsule(.009,.06,side*.064,1.632,.145,'#292333'));
      parts.at(-1).rotation=[0,0,Math.PI/2+side*.08];
    }
    // A small segmented smile, merged into one face mesh, needs no texture.
    for(let i=0;i<7;i++){
      const x=(i-3)*.010;
      parts.push(sphere(.014,.012,.012,x,1.510+.50*x*x/.03,.154,'#292333'));
    }
    return parts;
  };
  const headParts=()=>[
    sphere(.345,.35,.315,0,1.565,0,skin),
    capsule(.064,.15,0,1.36,0,skin),
    sphere(.052,.049,.048,0,1.545,.158,skin),
    ...[-1,1].map(s=>sphere(.052,.083,.065,s*.167,1.563,0,skin)),
  ];
  function head(parent,skinMaterial,ai,female) {
    if(!ai){
      const mesh=shell('human head','head',headParts(),parent,skinMaterial);
      shell('human expression','toy expression',faceParts(),parent,dark);
      return mesh;
    }
    const hairstyle=[sphere(.37,.18,.34,0,1.715,-.022,hair)];
    if(female){
      hairstyle.push(sphere(.36,.30,.14,0,1.56,-.13,hair));
      for(const s of [-1,1])hairstyle.push(capsule(.06,.31,s*.17,1.57,-.025,hair));
    }else{
      hairstyle.push(sphere(.27,.10,.14,-.025,1.69,.11,hair));
    }
    return shell('crowd head '+female,'head',[...headParts(),...faceParts(),...hairstyle],parent,white,true);
  }
  function torso(parent,shirt,ai,female) {
    const profile=female?[[.20,-.31],[.16,-.10],[.20,.17],[.225,.27],[.14,.32]]
      :[[.21,-.31],[.22,-.10],[.25,.16],[.275,.26],[.15,.32]];
    const part={kind:'CreateLathe',options:{shape:profile.map(([r,y])=>new B.Vector3(r,y,0)),tessellation:12,cap:B.Mesh.CAP_ALL},scale:[1,1,.77],at:[0,0,0],ink:shirt.diffuseColor.toHexString()};
    const mesh=shell('torso '+ai+' '+female+' '+shirt.uniqueId,'torso',[part],parent,ai?white:shirt,ai);
    mesh.position.y=ai?1.06:1.04;
    return mesh;
  }
  function limb(parent,arm,shirt,pants,skinMaterial,ai,female) {
    const cloth=shirt.diffuseColor.toHexString(),trousers=pants.diffuseColor.toHexString();
    const parts=arm?[
      capsule(.078,.26,0,-.12,0,skin),
      sphere(.145,.14,.145,0,-.263,0,skin),
      capsule(.072,.25,0,-.385,0,skin),
    ]:[
      capsule(.096,.35,0,-.17,0,trousers),
      sphere(.18,.15,.18,0,-.36,0,trousers),
      capsule(.09,.32,0,-.51,0,trousers),
    ];
    if(ai&&arm){parts[0].ink=cloth;}
    const hands=[sphere(.16,.16,.14,0,-.525,.006,skin),sphere(.055,.085,.06,.060,-.512,.042,skin)];
    const shoes=[sphere(.21,.14,.31,0,-.70,.045,shoe),box(.20,.045,.28,0,-.755,.045,sole)];
    const add=arm?hands:shoes;
    if(ai)return shell('crowd limb '+arm+' '+female+' '+shirt.uniqueId,arm?'block arm':'block leg',[...parts,...add],parent,white,true);
    const mesh=shell('human limb '+arm,arm?'arm':'leg',parts,parent,arm?skinMaterial:pants);
    shell('human '+(arm?'hand':'shoe'),arm?'toy hand':'toy shoe',add,parent,arm?skinMaterial:white,!arm);
    return mesh;
  }
  return {head,torso,limb};
}
