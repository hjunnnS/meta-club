// Adult, fully clothed event staff only. Player, DJ, bartender and house guests are untouched.
export function paradeWoman(B,scene,model,index){
 const own=[],palette=['#bb4e99','#36aaa7','#c66b51','#7564bf','#447bb7'];
 const material=(name,color)=>{const ink=new B.StandardMaterial('parade woman '+name,scene);ink.diffuseColor=B.Color3.FromHexString(color);ink.emissiveColor=ink.diffuseColor.scale(.12);ink.specularColor.set(.12,.12,.12);own.push(ink);return ink;};
 const fabric=material('opaque bra top',palette[index%5]),skin=material('skin','#ddb194'),dark=material('shorts','#211d30'),hair=material('hair',index%2?'#51362b':'#d9b566'),face=material('face','#342333');
 model.root.metadata={ageGroup:'adult',gender:'woman',outfit:'opaque bra top and shorts',role:'parade',decorative:true};
 function part(name,kind,options,position,ink,parent=model.near){const mesh=B.MeshBuilder[kind]('parade woman '+name,options,scene);mesh.parent=parent;mesh.position.set(...position);mesh.material=ink;mesh.isPickable=false;return mesh;}
 const torso=model.torso||model.near.getChildMeshes()[0];if(torso){torso.material=fabric;torso.scaling.y=.40;torso.position.y=1.20;}
 for(const mesh of model.near.getChildMeshes())if(mesh.name==='head')mesh.material=skin;
 for(const joint of [model.limbs[0],model.limbs[2]])for(const mesh of joint.getChildMeshes())mesh.material=skin;
 const waist=part('midriff','CreateCapsule',{radius:.19,height:.35,tessellation:12},[0,.98,0],skin);waist.scaling.z=.82;
 part('shorts','CreateBox',{width:.47,height:.23,depth:.34},[0,.78,0],dark);
 part('top band','CreateBox',{width:.46,height:.055,depth:.33},[0,1.075,.01],fabric);
 for(const side of [-1,1]){
  const cup=part('clothed bust','CreateSphere',{diameter:.43,segments:14},[side*.16,1.235,.145],fabric);cup.scaling.set(1,.86,1.08);
  part('top strap','CreateBox',{width:.036,height:.18,depth:.12},[side*.17,1.365,.025],fabric);
  part('eye','CreateBox',{width:.035,height:.04,depth:.012},[side*.061,1.585,.16],face);
  part('side hair','CreateCapsule',{radius:.065,height:.48,tessellation:8},[side*.18,1.50,-.015],hair);
 }
 const crown=part('hair crown','CreateSphere',{diameter:.41,segments:12},[0,1.72,-.025],hair);crown.scaling.y=.65;
 part('back hair','CreateCapsule',{radius:.17,height:.56,tessellation:12},[0,1.43,-.145],hair);
 part('mouth','CreateBox',{width:.062,height:.013,depth:.012},[0,1.48,.165],face);
 const dispose=model.dispose.bind(model);model.dispose=()=>{dispose();own.forEach(ink=>ink.dispose());};return model;
}
