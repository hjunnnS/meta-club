// Cosmetic geometry only: existing rig, movement, dances and lighting stay in control.
export const appearanceOptions={
 body:[['male','남성형'],['female','여성형']],
 hair:[['short','짧은 머리'],['bob','단발'],['long','긴 머리'],['ponytail','포니테일'],['parted','가르마'],['bald','대머리']],
 top:[['tee','티셔츠'],['tank','나시'],['jacket','재킷']],
 bottom:[['trousers','긴바지'],['shorts','반바지'],['miniskirt','미니스커트'],['hotpants','핫팬츠']],
 glasses:[['none','착용 안 함'],['sunglasses','선글라스'],['round','둥근 안경'],['square','사각 안경']],
};
export const appearanceColors=[['black','블랙','#222332'],['brown','브라운','#684335'],['blond','금발·골드','#e7bd66'],['white','화이트','#e9eaf2'],['violet','라벤더','#9c83df'],['pink','로즈 핑크','#e778aa'],['blue','블루','#4f9ac5'],['teal','민트','#54bda9']];
export const defaultAppearance=Object.freeze({body:'male',hair:'short',top:'tee',bottom:'trousers',glasses:'none',hairColor:'brown',topColor:'violet',bottomColor:'black',glassesColor:'black'});
const keys=Object.keys(defaultAppearance);
export const bodyAppearanceOptions={
 male:{hair:['short','parted','bald'],bottom:['trousers','shorts']},
 female:{hair:['bob','long','ponytail'],bottom:['miniskirt','hotpants']},
};
export function appearanceChoices(body,key){const allowed=bodyAppearanceOptions[body]?.[key];return allowed?appearanceOptions[key].filter(([id])=>allowed.includes(id)):appearanceOptions[key]||appearanceColors;}
export function validAppearance(value){
 return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key))&&keys.every(key=>key==='body'&&!Object.hasOwn(value,key)||Object.hasOwn(value,key)&&(appearanceOptions[key]?appearanceOptions[key].some(([id])=>id===value[key]):appearanceColors.some(([id])=>id===value[key]))));
}
export function normalizeAppearance(value){
 const normalized=Object.fromEntries(keys.map(key=>[key,(appearanceOptions[key]||appearanceColors).some(([id])=>id===value?.[key])?value[key]:defaultAppearance[key]]));
 for(const key of ['hair','bottom']){
  const allowed=bodyAppearanceOptions[normalized.body][key];
  if(!allowed.includes(normalized[key]))normalized[key]=allowed[0];
 }
 return normalized;
}
export function characterAppearance(B,scene,model){
 let signature='',parts=[],inks=[],originals=new Map();
 const torsoVisible=model.torso.isVisible;
 const remember=mesh=>{if(mesh&&!originals.has(mesh))originals.set(mesh,mesh.material);};
 function clear(){model.torso.isVisible=torsoVisible;for(const mesh of parts)mesh.dispose();parts=[];for(const [mesh,material]of originals)if(!mesh.isDisposed())mesh.material=material;originals.clear();for(const ink of inks)ink.dispose();inks=[];}
 function ink(name,color){const m=new B.StandardMaterial('character outfit '+name,scene);m.diffuseColor=B.Color3.FromHexString(appearanceColors.find(([id])=>id===color)[2]);m.emissiveColor=m.diffuseColor.scale(.08);m.specularColor.set(.08,.08,.08);inks.push(m);return m;}
 function piece(name,kind,options,pos,material,parent=model.near){const mesh=B.MeshBuilder[kind]('character outfit '+name,options,scene);mesh.parent=parent;mesh.position.set(...pos);mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;parts.push(mesh);return mesh;}
 const box=(name,w,h,d,pos,material,parent)=>piece(name,'CreateBox',{width:w,height:h,depth:d},pos,material,parent);
 const ball=(name,w,h,d,pos,material,parent)=>{const m=piece(name,'CreateSphere',{diameter:1,segments:12},pos,material,parent);m.scaling.set(w,h,d);return m;};
 const tube=(name,r,h,pos,material,parent)=>piece(name,'CreateCapsule',{radius:r,height:h,tessellation:10,subdivisions:1},pos,material,parent);
 function paint(mesh,material){remember(mesh);mesh.material=material;}
 return {
  set(value){
   const style=normalizeAppearance(value),key=JSON.stringify(style);if(signature===key)return;signature=key;clear();
   const hair=ink('hair',style.hairColor),top=ink('top',style.topColor),bottom=ink('bottom',style.bottomColor),frame=ink('glasses',style.glassesColor);
   const head=model.near.getChildMeshes().find(m=>m.name==='head'),skin=head?.material;
   paint(model.torso,top);
   // Replace only the visible torso shell. Its existing pivot still drives every dance.
   model.torso.isVisible=false;
   const female=style.body==='female',shoulder=female?.225:.28;
   const profile=female?[[.215,-.34],[.18,-.20],[.155,-.07],[.20,.14],[shoulder,.26],[.14,.34]]:[[.21,-.34],[.22,-.20],[.23,.06],[.26,.18],[shoulder,.26],[.16,.34]];
   const body=piece('fitted torso','CreateLathe',{shape:profile.map(([r,y])=>new B.Vector3(r,y,0)),tessellation:16,cap:B.Mesh.CAP_ALL},[0,0,0],top,model.torso);
   body.scaling.z=female?.77:.80;
   ball('clothed hips',female?.49:.44,.20,.32,[0,.80,0],bottom);
   if(female)for(const side of [-1,1])ball('fitted upper chest',.22,.20,.16,[side*.105,.16,.12],top,model.torso);

   for(const i of [0,2])for(const mesh of model.limbs[i].getChildMeshes()){
    if(mesh.name!=='arm')continue;paint(mesh,style.top==='jacket'?top:skin||mesh.material);
    if(style.top==='tee')tube('short sleeve',.087,.23,[0,-.09,0],top,model.limbs[i]);
   }
   for(const i of [1,3])for(const mesh of model.limbs[i].getChildMeshes()){
    if(mesh.name!=='leg')continue;paint(mesh,style.bottom==='trousers'?bottom:skin||mesh.material);
    if(['shorts','hotpants','miniskirt'].includes(style.bottom)){
     const short=style.bottom!=='shorts';
     tube(short?'fitted shorts leg':'shorts leg',.105,short?.23:.36,[0,short?-.085:-.15,0],bottom,model.limbs[i]);
    }
   }
   if(['shorts','hotpants'].includes(style.bottom))ball('shorts waist',female?.49:.45,.18,.34,[0,.80,0],bottom);
   if(style.bottom==='miniskirt'){
    const skirt=piece('mini skirt','CreateCylinder',{height:.28,diameterTop:.48,diameterBottom:.65,tessellation:24,cap:B.Mesh.CAP_ALL},[0,.74,0],bottom);
    skirt.scaling.z=.76;
   }
   if(style.top==='tank'){
    for(const side of [-1,1])box('tank strap',female?.043:.07,.17,.08,[side*(female?.13:.16),.31,.08],top,model.torso);
   }else if(style.top==='jacket'){
    const lining=ink('jacket lining','white');
    box('jacket shirt',female?.13:.17,.41,.055,[0,.05,.18],lining,model.torso);
    for(const side of [-1,1]){const lapel=box('jacket lapel',female?.075:.095,.30,.07,[side*(female?.095:.115),.19,.19],top,model.torso);lapel.rotation.z=side*.20;}
   }
   if(style.hair!=='bald')ball('hair crown',.37,.18,.35,[0,1.73,-.018],hair);
   if(style.hair==='short'){
    ball('short fringe',.29,.09,.10,[0,1.68,.115],hair);
    for(const side of [-1,1])ball('short side',.075,.16,.20,[side*.155,1.64,-.025],hair);
   }else if(style.hair==='bob'){
    for(const side of [-1,1])tube('bob side',.073,.40,[side*.175,1.53,-.025],hair);
    ball('bob back',.35,.34,.13,[0,1.53,-.135],hair);
   }else if(style.hair==='long'){
    ball('long back',.38,.69,.16,[0,1.34,-.17],hair);
    for(const side of [-1,1])tube('long side',.065,.50,[side*.18,1.46,-.025],hair);
   }else if(style.hair==='parted'){
    for(const side of [-1,1]){const fringe=ball('parted fringe',side<0?.19:.14,.12,.13,[side*.075,1.70,.115],hair);fringe.rotation.z=side*.23;}
    ball('parted back',.33,.16,.17,[0,1.65,-.11],hair);
   }else if(style.hair==='ponytail'){
    const tail=tube('ponytail',.095,.50,[0,1.47,-.265],hair);tail.rotation.x=-.32;
    ball('hair tie',.12,.10,.12,[0,1.68,-.20],frame);
   }
   if(style.glasses!=='none'){
    const lens=ink('lenses','black');lens.alpha=style.glasses==='sunglasses'?.92:.17;
    for(const side of [-1,1]){
     if(style.glasses==='round'){
      const rim=piece('round frame','CreateTorus',{diameter:.128,thickness:.018,tessellation:20},[side*.084,1.59,.166],frame);rim.rotation.x=Math.PI/2;
      const glass=piece('round lens','CreateDisc',{radius:.056,tessellation:20,sideOrientation:B.Mesh.DOUBLESIDE},[side*.084,1.59,.17],lens);glass.rotation.y=Math.PI;
     }else{
      const h=style.glasses==='sunglasses'?.095:.10;
      box('lens',.113,h,.018,[side*.082,1.59,.173],lens);
      for(const y of [-1,1])box('frame horizontal',.135,.017,.025,[side*.082,1.59+y*h/2,.178],frame);
      for(const x of [-1,1])box('frame vertical',.016,h,.025,[side*.082+x*.063,1.59,.178],frame);
     }
     box('glasses arm',.017,.018,.19,[side*.158,1.59,.084],frame);
    }
    box('glasses bridge',.045,.018,.027,[0,1.59,.178],frame);
   }
  },
  dispose(){clear();signature='';},
 };
}
