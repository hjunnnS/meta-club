// Cosmetic geometry only: existing rig, movement, dances and lighting stay in control.
export const appearanceOptions={
 hair:[['short','짧은 머리'],['bob','단발'],['long','긴 머리'],['ponytail','포니테일']],
 top:[['tee','티셔츠'],['tank','나시'],['jacket','재킷']],
 bottom:[['trousers','긴바지'],['shorts','반바지']],
 glasses:[['none','착용 안 함'],['sunglasses','선글라스'],['round','둥근 안경'],['square','사각 안경']],
};
export const appearanceColors=[['black','블랙','#222332'],['brown','브라운','#684335'],['blond','금발·골드','#e7bd66'],['white','화이트','#e9eaf2'],['violet','라벤더','#9c83df'],['pink','로즈 핑크','#e778aa'],['blue','블루','#4f9ac5'],['teal','민트','#54bda9']];
export const defaultAppearance=Object.freeze({hair:'short',top:'tee',bottom:'trousers',glasses:'none',hairColor:'brown',topColor:'violet',bottomColor:'black',glassesColor:'black'});
const keys=Object.keys(defaultAppearance);
export function validAppearance(value){
 return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)&&(appearanceOptions[key]?appearanceOptions[key].some(([id])=>id===value[key]):appearanceColors.some(([id])=>id===value[key]))));
}
export function normalizeAppearance(value){return Object.fromEntries(keys.map(key=>[key,(appearanceOptions[key]||appearanceColors).some(([id])=>id===value?.[key])?value[key]:defaultAppearance[key]]));}
export function characterAppearance(B,scene,model){
 let signature='',parts=[],inks=[],originals=new Map();
 const remember=mesh=>{if(mesh&&!originals.has(mesh))originals.set(mesh,mesh.material);};
 function clear(){for(const mesh of parts)mesh.dispose();parts=[];for(const [mesh,material]of originals)if(!mesh.isDisposed())mesh.material=material;originals.clear();for(const ink of inks)ink.dispose();inks=[];}
 function ink(name,color){const m=new B.StandardMaterial('character outfit '+name,scene);m.diffuseColor=B.Color3.FromHexString(appearanceColors.find(([id])=>id===color)[2]);m.emissiveColor=m.diffuseColor.scale(.08);m.specularColor.set(.08,.08,.08);inks.push(m);return m;}
 function piece(name,kind,options,pos,material,parent=model.near){const mesh=B.MeshBuilder[kind]('character outfit '+name,options,scene);mesh.parent=parent;mesh.position.set(...pos);mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;parts.push(mesh);return mesh;}
 const box=(name,w,h,d,pos,material,parent)=>piece(name,'CreateBox',{width:w,height:h,depth:d},pos,material,parent);
 const ball=(name,w,h,d,pos,material,parent)=>{const m=piece(name,'CreateSphere',{diameter:1,segments:12},pos,material,parent);m.scaling.set(w,h,d);return m;};
 const tube=(name,r,h,pos,material,parent)=>piece(name,'CreateCapsule',{radius:r,height:h,tessellation:10,subdivisions:1},pos,material,parent);
 function paint(mesh,material){remember(mesh);mesh.material=material;}
 return {
  set(value){
   const style=value?normalizeAppearance(value):null,key=JSON.stringify(style);if(signature===key)return;signature=key;clear();if(!style)return;
   const hair=ink('hair',style.hairColor),top=ink('top',style.topColor),bottom=ink('bottom',style.bottomColor),frame=ink('glasses',style.glassesColor);
   const head=model.near.getChildMeshes().find(m=>m.name==='head'),skin=head?.material;
   paint(model.torso,top);
   for(const i of [0,2])for(const mesh of model.limbs[i].getChildMeshes()){
    if(mesh.name!=='arm')continue;paint(mesh,style.top==='jacket'?top:skin||mesh.material);
    if(style.top==='tee')tube('short sleeve',.087,.23,[0,-.09,0],top,model.limbs[i]);
   }
   for(const i of [1,3])for(const mesh of model.limbs[i].getChildMeshes()){
    if(mesh.name!=='leg')continue;paint(mesh,style.bottom==='trousers'?bottom:skin||mesh.material);
    if(style.bottom==='shorts')tube('shorts leg',.105,.36,[0,-.15,0],bottom,model.limbs[i]);
   }
   if(style.bottom==='shorts')ball('shorts waist',.45,.22,.34,[0,.80,0],bottom);
   if(style.top==='tank'){
    for(const side of [-1,1])box('tank strap',.055,.17,.08,[side*.13,1.35,.08],top);
   }else if(style.top==='jacket'){
    const lining=ink('jacket lining','white');
    box('jacket shirt',.15,.41,.055,[0,1.09,.205],lining);
    for(const side of [-1,1]){const lapel=box('jacket lapel',.09,.30,.07,[side*.105,1.23,.215],top);lapel.rotation.z=side*.20;}
   }
   ball('hair crown',.37,.18,.35,[0,1.73,-.018],hair);
   if(style.hair==='short'){
    box('short fringe',.29,.075,.055,[0,1.68,.145],hair);
    for(const side of [-1,1])ball('short side',.075,.16,.20,[side*.155,1.64,-.025],hair);
   }else if(style.hair==='bob'){
    for(const side of [-1,1])tube('bob side',.073,.40,[side*.175,1.53,-.025],hair);
    ball('bob back',.35,.34,.13,[0,1.53,-.135],hair);
   }else if(style.hair==='long'){
    ball('long back',.38,.69,.16,[0,1.34,-.17],hair);
    for(const side of [-1,1])tube('long side',.065,.50,[side*.18,1.46,-.025],hair);
   }else{
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
