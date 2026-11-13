import {edmFloor,edmStage} from './edm-layout.js';
import {shoutScreen} from './shout-screen.js';

// Follow the rectangular floor edge at walking pace, turning the front-left corner.
// The rear edge stays in front of the DJ platform; podiums, tables and stairs are untouched.
const routeX=edmFloor.width/2+.9,routeFront=edmFloor.maxZ+.9,routeRear=edmFloor.minZ+1;
export const paradeRoute=[[routeX,routeFront],[-routeX,routeFront],[-routeX,routeRear],[routeX,routeRear]];
export function paradePose(age,index){
 const path=paradeRoute,lengths=path.map((p,i)=>Math.hypot(path[(i+1)%path.length][0]-p[0],path[(i+1)%path.length][1]-p[1])),total=lengths.reduce((a,b)=>a+b,0);
 let distance=((age*2.7-index*1.1)%total+total)%total,i=0;
 while(distance>lengths[i]&&i<lengths.length-1){distance-=lengths[i];i++;}
 const a=path[i],b=path[(i+1)%path.length],t=distance/lengths[i],next=path[(i+2)%path.length];
 const yaw=Math.atan2(a[0]-b[0],a[1]-b[1]),turn=Math.min(1,Math.max(0,(distance-lengths[i]+.75)/.75));
 const nextYaw=Math.atan2(b[0]-next[0],b[1]-next[1]),delta=Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw));
 return {x:a[0]+(b[0]-a[0])*t,y:.018,z:a[1]+(b[1]-a[1])*t,yaw:yaw+delta*turn};
}
export function clubEventRenderer(B,scene,glow,make,{messageScreen=(text,name)=>shoutScreen(B,scene,text,name)}={}){
 let nextShout=null,nextParade=null,screens=[],screenId=null,staff=[],paradeId=null,bottleInk,creamInk;
 function clearScreen(){for(const screen of screens){glow?.removeExcludedMesh(screen);const ink=screen.material,texture=ink?.emissiveTexture;screen.dispose();ink?.dispose();texture?.dispose();}screens=[];screenId=null;}
 function wingMessage(event,side){
  const screen=messageScreen(event.text,event.nickname),{widthRatio,heightRatio,angle,gap,y}=edmStage.wingScreens;
  const width=edmStage.screen.width*widthRatio,height=edmStage.screen.height*heightRatio,half=width/2;
  screen.name='shout wing '+(side<0?'left':'right');screen.scaling.set(width/12.8,height/5.3,1);
  const root=scene.getTransformNodeByName('EDM angled wing '+side);
  if(root){screen.parent=root;screen.position.set(0,0,.035);screen.rotation.set(0,0,0);}
  else{screen.position.set(edmStage.screen.x+side*(edmStage.screen.width/2+gap+half*Math.cos(angle)),y,edmStage.screen.z+half*Math.sin(angle));screen.rotation.y=-side*angle;screen.position.addInPlace(new B.Vector3(Math.sin(screen.rotation.y),0,Math.cos(screen.rotation.y)).scale(.035));}
  glow?.addExcludedMesh(screen);return screen;
 }

 function clearParade(){for(const entry of staff){entry.model.dispose();entry.bottles.forEach(({bottle,lines})=>{bottle.dispose();lines.forEach(line=>line.dispose());});}staff=[];bottleInk?.dispose();creamInk?.dispose();bottleInk=creamInk=null;paradeId=null;}
 function startParade(event){
  clearParade();paradeId=event.id;
  bottleInk=new B.StandardMaterial('VIP green bottles',scene);bottleInk.diffuseColor=B.Color3.FromHexString('#145a39');bottleInk.specularColor=new B.Color3(.45,.45,.45);
  creamInk=new B.StandardMaterial('VIP bottle labels',scene);creamInk.diffuseColor=B.Color3.FromHexString('#ffe2a0');
  for(let i=0;i<event.count;i++){
   const pose=paradePose(0,i),model=make({id:event.id+'-staff-'+i,ai:true,nickname:'VIP 스태프 '+(i+1),avatar:['gold','teal','rose','indigo','gold'][i],...pose,action:'walk'});
   model.near.setEnabled(true);model.far.setEnabled(false);
   const bottles=[];for(const arm of [0,2]){
   const bottle=new B.TransformNode('VIP bottle holder',scene);
   const body=B.MeshBuilder.CreateCylinder('VIP beer bottle',{height:.29,diameter:.12,tessellation:12},scene);body.parent=bottle;body.position.y=.12;body.material=bottleInk;body.isPickable=false;
   const neck=B.MeshBuilder.CreateCylinder('VIP bottle neck',{height:.13,diameter:.055,tessellation:10},scene);neck.parent=bottle;neck.position.y=.32;neck.material=bottleInk;neck.isPickable=false;
   const label=B.MeshBuilder.CreateBox('VIP beer label',{width:.087,height:.12,depth:.006},scene);label.parent=bottle;label.position.set(0,.13,.061);label.material=creamInk;label.isPickable=false;
   const lines=[];for(let j=0;j<9;j++){const line=B.MeshBuilder.CreateLines('VIP bottle spark',{points:[B.Vector3.Zero(),B.Vector3.Up().scale(.05)],updatable:true},scene);line.color=B.Color3.FromHexString(j%2?'#ffd15d':'#fff3cd');line.isPickable=false;lines.push(line);}
   bottles.push({arm,bottle,lines});}
   staff.push({model,bottles,index:i});
  }
 }
 function render(now){
  if(!nextShout||now>=nextShout.start+nextShout.seconds*1000)clearScreen();
  else if(now>=nextShout.start&&screenId!==nextShout.id){
   clearScreen();screens=[-1,1].map(side=>wingMessage(nextShout,side));screenId=nextShout.id;
  }
  for(const screen of screens)screen.metadata?.animateShout?.((now-nextShout.start)/1000);
  if(!nextParade||now>=nextParade.start+nextParade.seconds*1000){if(paradeId)clearParade();return;}
  const age=(now-nextParade.start)/1000;if(age<0)return;
  if(paradeId!==nextParade.id)startParade(nextParade);
  const fade=Math.max(0,Math.min(1,age/.35,(nextParade.seconds-age)/.45));
  for(const entry of staff){
   const {model,bottles,index}=entry,pose=paradePose(age,index),step=Math.sin(age*8-index*.7);
   model.root.position.set(pose.x,pose.y,pose.z);model.root.rotation.y=pose.yaw;model.near.position.y=Math.abs(step)*.035;
   model.limbs.forEach((joint,i)=>{joint.rotationQuaternion=null;joint.rotation.x=i%2===0?-1.20+step*.07:.50*step*(i<2?1:-1);joint.rotation.z=i%2===0?(i===0?-.14:.14):0;});
   model.root.getChildMeshes().forEach(mesh=>mesh.visibility=fade);
   model.root.computeWorldMatrix(true);model.near.computeWorldMatrix(true);
   for(const {arm,bottle,lines}of bottles){model.limbs[arm].computeWorldMatrix(true);
   bottle.position.copyFrom(B.Vector3.TransformCoordinates(new B.Vector3(0,-.57,0),model.limbs[arm].getWorldMatrix()));bottle.rotation.y=pose.yaw;
   bottle.getChildMeshes().forEach(mesh=>mesh.visibility=fade);
   for(let j=0;j<lines.length;j++){
    const t=(age*2.3+j*.117+index*.13)%1,a=j*2.399;
    const point=u=>bottle.position.add(new B.Vector3(Math.cos(a)*u*.24,.40+u*.95-u*u*.35,Math.sin(a)*u*.24));
    B.MeshBuilder.CreateLines('VIP bottle spark',{points:[point(Math.max(0,t-.09)),point(t)],instance:lines[j]},scene);lines[j].alpha=fade*(1-t*.65);
   }}
  }
 }
 scene.onDisposeObservable.addOnce(()=>{clearScreen();clearParade();});
 return {set({shout=null,parade=null}={}){nextShout=shout;nextParade=parade;},render,
  stop(){nextShout=nextParade=null;clearScreen();clearParade();},
  count(){return staff.length;},hasScreen(){return screens.length===2;}};
}
