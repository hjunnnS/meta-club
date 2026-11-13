import {edmFloor,edmStage} from './edm-layout.js';
import {ledScreen} from '/stage/festival/events.js';

// A short walk in the open west aisle; never enters tables, stairs or the podiums.
export function paradePose(age,index){
 const x=-edmFloor.width/2-2,path=[[x,6.8],[x,-1.8],[x-1.3,-4],[x-1.3,6.8]],lengths=path.map((p,i)=>Math.hypot(path[(i+1)%path.length][0]-p[0],path[(i+1)%path.length][1]-p[1]));
 const total=lengths.reduce((a,b)=>a+b,0);let distance=((age/10*total-index*1.05)%total+total)%total;
 let i=0;while(distance>lengths[i]&&i<lengths.length-1){distance-=lengths[i];i++;}
 const a=path[i],b=path[(i+1)%path.length],t=distance/lengths[i];
 return {x:a[0]+(b[0]-a[0])*t,y:.018,z:a[1]+(b[1]-a[1])*t,yaw:Math.atan2(a[0]-b[0],a[1]-b[1])};
}
export function clubEventRenderer(B,scene,glow,make,{messageScreen=(text,name)=>ledScreen(B,scene,text,name)}={}){
 let nextShout=null,nextParade=null,screen=null,screenId=null,staff=[],paradeId=null,bottleInk,creamInk;
 function clearScreen(){if(!screen)return;glow?.removeExcludedMesh(screen);const ink=screen.material,texture=ink?.emissiveTexture;screen.dispose();ink?.dispose();texture?.dispose();screen=null;screenId=null;}
 function clearParade(){for(const entry of staff){entry.model.dispose();entry.bottle.dispose();entry.lines.forEach(line=>line.dispose());}staff=[];bottleInk?.dispose();creamInk?.dispose();bottleInk=creamInk=null;paradeId=null;}
 function startParade(event){
  clearParade();paradeId=event.id;
  bottleInk=new B.StandardMaterial('VIP green bottles',scene);bottleInk.diffuseColor=B.Color3.FromHexString('#145a39');bottleInk.specularColor=new B.Color3(.45,.45,.45);
  creamInk=new B.StandardMaterial('VIP bottle labels',scene);creamInk.diffuseColor=B.Color3.FromHexString('#ffe2a0');
  for(let i=0;i<event.count;i++){
   const pose=paradePose(0,i),model=make({id:event.id+'-staff-'+i,ai:true,nickname:'VIP 스태프 '+(i+1),avatar:['gold','teal','rose','indigo','gold'][i],...pose,action:'walk'});
   model.near.setEnabled(true);model.far.setEnabled(false);
   const bottle=new B.TransformNode('VIP bottle holder',scene);
   const body=B.MeshBuilder.CreateCylinder('VIP beer bottle',{height:.29,diameter:.12,tessellation:12},scene);body.parent=bottle;body.position.y=.12;body.material=bottleInk;body.isPickable=false;
   const neck=B.MeshBuilder.CreateCylinder('VIP bottle neck',{height:.13,diameter:.055,tessellation:10},scene);neck.parent=bottle;neck.position.y=.32;neck.material=bottleInk;neck.isPickable=false;
   const label=B.MeshBuilder.CreateBox('VIP beer label',{width:.087,height:.12,depth:.006},scene);label.parent=bottle;label.position.set(0,.13,.061);label.material=creamInk;label.isPickable=false;
   const lines=[];for(let j=0;j<9;j++){const line=B.MeshBuilder.CreateLines('VIP bottle spark',{points:[B.Vector3.Zero(),B.Vector3.Up().scale(.05)],updatable:true},scene);line.color=B.Color3.FromHexString(j%2?'#ffd15d':'#fff3cd');line.isPickable=false;lines.push(line);}
   staff.push({model,bottle,lines,index:i});
  }
 }
 function render(now){
  if(!nextShout||now>=nextShout.start+nextShout.seconds*1000)clearScreen();
  else if(now>=nextShout.start&&screenId!==nextShout.id){
   clearScreen();screen=messageScreen(nextShout.text,nextShout.nickname);screenId=nextShout.id;
   screen.scaling.set(1.42,1.21,1);screen.position.set(edmStage.screen.x,edmStage.screen.y,edmStage.screen.z+.08);glow?.addExcludedMesh(screen);
  }
  if(!nextParade||now>=nextParade.start+nextParade.seconds*1000){if(paradeId)clearParade();return;}
  const age=(now-nextParade.start)/1000;if(age<0)return;
  if(paradeId!==nextParade.id)startParade(nextParade);
  const fade=Math.max(0,Math.min(1,age/.35,(nextParade.seconds-age)/.45));
  for(const entry of staff){
   const {model,bottle,lines,index}=entry,pose=paradePose(age,index),step=Math.sin(age*8-index*.7);
   model.root.position.set(pose.x,pose.y,pose.z);model.root.rotation.y=pose.yaw;model.near.position.y=Math.abs(step)*.035;
   model.limbs.forEach((joint,i)=>{joint.rotationQuaternion=null;joint.rotation.x=i===2?-1.05:(i%2===0?.45:.55)*step*(i<2?1:-1);joint.rotation.z=i===2?-.18:0;});
   model.root.getChildMeshes().forEach(mesh=>mesh.visibility=fade);
   model.root.computeWorldMatrix(true);model.near.computeWorldMatrix(true);model.limbs[2].computeWorldMatrix(true);
   bottle.position.copyFrom(B.Vector3.TransformCoordinates(new B.Vector3(0,-.57,0),model.limbs[2].getWorldMatrix()));bottle.rotation.y=pose.yaw;
   bottle.getChildMeshes().forEach(mesh=>mesh.visibility=fade);
   for(let j=0;j<lines.length;j++){
    const t=(age*2.3+j*.117+index*.13)%1,a=j*2.399;
    const point=u=>bottle.position.add(new B.Vector3(Math.cos(a)*u*.24,.40+u*.95-u*u*.35,Math.sin(a)*u*.24));
    B.MeshBuilder.CreateLines('VIP bottle spark',{points:[point(Math.max(0,t-.09)),point(t)],instance:lines[j]},scene);lines[j].alpha=fade*(1-t*.65);
   }
  }
 }
 scene.onDisposeObservable.addOnce(()=>{clearScreen();clearParade();});
 return {set({shout=null,parade=null}={}){nextShout=shout;nextParade=parade;},render,
  stop(){nextShout=nextParade=null;clearScreen();clearParade();},
  count(){return staff.length;},hasScreen(){return Boolean(screen);}};
}
