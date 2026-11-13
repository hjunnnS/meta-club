import {edmSeats,edmBalcony} from './edm-layout.js';
import {wandOrnament} from './wand-ornament.js';
import {socialDurations} from './social-trial.js';

export function cakePosition(actor){
  const seat=edmSeats[actor.seat];
  if(seat?.balcony){const p=edmBalcony.pockets[seat.area];return {x:p.x+p.fx*1.28-p.fz*.16,y:4.51,z:p.z+p.fz*1.28+p.fx*.16};}
  if(seat?.table)return {x:18.5,y:.72,z:[16.6,12.2,1,-3.4,-10.2,-14.6][seat.table-1]};
  return {x:Math.max(-20.2,Math.min(20.2,actor.x-Math.sin(actor.yaw||0)*1.05+Math.cos(actor.yaw||0)*.9)),
    y:actor.y+.04,z:Math.max(-19.5,Math.min(19.5,actor.z-Math.cos(actor.yaw||0)*1.05-Math.sin(actor.yaw||0)*.9))};
}

// Additive, visual-only overlays. Never write to existing lights, screens, music or poses.
export function socialEffects(B,scene,glow){
  const records=new Map();let shared=[],sequence=0;
  function create(event){
    const root=new B.TransformNode('social overlay '+event.id,scene),inks=[],lights=[],meshes=[];
    const ink=(name,color,alpha=1)=>{const m=new B.StandardMaterial('social '+name,scene);m.disableLighting=true;m.emissiveColor=B.Color3.FromHexString(color);m.alpha=alpha;inks.push(m);return m;};
    const rose=ink('rose','#ff72bf'),white=ink('cream','#fff0df'),gold=ink('gold','#ffd879'),green=ink('leaves','#4ed6ad');
    function part(mesh,material,x=0,y=0,z=0){mesh.parent=root;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=false;meshes.push(mesh);return mesh;}
    const sphere=(name,diameter,material,x,y,z)=>part(B.MeshBuilder.CreateSphere('social '+name,{diameter,segments:8},scene),material,x,y,z);
    const cylinder=(name,height,diameter,material,x,y,z)=>part(B.MeshBuilder.CreateCylinder('social '+name,{height,diameter,tessellation:20},scene),material,x,y,z);
    const record={event,root,inks,lights,meshes,excluded:[]};
    if(event.kind==='birthday'){
      const ring=part(B.MeshBuilder.CreateTorus('social birthday halo',{diameter:2.05,thickness:.025,tessellation:48},scene),gold,0,.06,0);
      const veil=ink('spot veil','#fff1cf',.035);
      const cone=part(B.MeshBuilder.CreateCylinder('social birthday spotlight',{height:3.5,diameterTop:.10,diameterBottom:1.5,tessellation:24},scene),veil,0,1.78,0);
      const crown=wandOrnament(B,scene,root,'crown',gold);crown.rotation.z=0;crown.position.y=2.25;crown.scaling.setAll(2.1);
      const light=new B.SpotLight('social birthday key',B.Vector3.Zero(),new B.Vector3(0,-1,0),.9,2,scene);
      light.diffuse=B.Color3.FromHexString('#ffe4c2');light.intensity=0;light.range=5;light.renderPriority=20;lights.push(light);
      const paper=[];for(let i=0;i<24;i++)paper.push(part(B.MeshBuilder.CreatePlane('social birthday confetti',{width:.055,height:.10},scene),[gold,rose,white][i%3]));
      Object.assign(record,{ring,cone,crown,light,paper});
    }else if(event.kind==='heart'){
      const hearts=[];for(let i=0;i<8;i++){const heart=wandOrnament(B,scene,root,'heart',rose);heart.rotation.z=0;heart.scaling.setAll(i?1.2:2.4);hearts.push(heart);}record.hearts=hearts;
    }else if(event.kind==='bouquet'){
      // Left hand: the right-hand wand and all existing dance joints remain untouched.
      const holder=new B.TransformNode('social bouquet holder',scene);holder.parent=root;
      const contents=[];
      for(let i=0;i<5;i++){
        const x=(i-2)*.075,z=Math.sin(i*2)*.075,y=.28+(i%2)*.07;
        contents.push(cylinder('flower stem',.40,.018,green,x,.06,z));
        contents.push(sphere('flower centre',.075,gold,x,y,z));
        for(let j=0;j<5;j++){const a=j*Math.PI*2/5;contents.push(sphere('flower petal',.10,i%2?white:rose,x+Math.cos(a)*.065,y+Math.sin(a)*.045,z));}
      }
      contents.push(cylinder('bouquet ribbon',.06,.19,gold,0,-.05,0));
      for(const mesh of contents)mesh.parent=holder;record.holder=holder;
    }else if(event.kind==='cake'){
      cylinder('cake plate',.035,.80,gold,0,.018,0);
      cylinder('cake lower',.22,.65,white,0,.145,0);cylinder('cake top',.16,.45,rose,0,.335,0);
      const flames=[];for(let i=0;i<3;i++){const x=(i-1)*.12;cylinder('candle',.15,.025,white,x,.48,0);flames.push(sphere('candle flame',.055,gold,x,.585,0));}record.flames=flames;
    }
    for(const mesh of root.getChildMeshes())if(/^wand (heart|crown)/.test(mesh.name)||event.kind==='bouquet'||event.kind==='cake'&&!mesh.name.includes('flame')){glow?.addExcludedMesh(mesh);record.excluded.push(mesh);}
    records.set(event.id,record);return record;
  }
  function dispose(record){for(const mesh of record.excluded)glow?.removeExcludedMesh(mesh);for(const light of record.lights)light.dispose();record.root.dispose();for(const material of record.inks)material.dispose();records.delete(record.event.id);}
  function render(now,models){
    const events=new Map(shared.map(e=>[e.id,e]));
    for(const record of records.values())if(record.event.local)events.set(record.event.id,record.event);
    for(const [id,event]of events){
      const target=models.get(event.to),sender=models.get(event.from),age=(now-event.start)/1000;
      if(!target||!sender||age<0||age>=event.seconds){const old=records.get(id);if(old)dispose(old);continue;}
      const record=records.get(id)||create(event),{root}=record;
      const fade=Math.min(1,age/.25,(event.seconds-age)/.6);
      for(const mesh of record.meshes)mesh.visibility=fade;
      root.position.copyFrom(target.root.position);
      if(event.kind==='birthday'){
        record.ring.rotation.y=age*.4;record.crown.rotation.y=age*.25;
        record.light.position.copyFrom(target.root.position).addInPlace(new B.Vector3(-.65,3.4,.55));
        record.light.direction=target.root.position.add(new B.Vector3(0,1,0)).subtract(record.light.position).normalize();
        record.light.includedOnlyMeshes=target.near.getChildMeshes();record.light.intensity=.32*fade;
        const end=Math.max(0,age-(event.seconds-4));
        record.paper.forEach((mesh,i)=>{mesh.setEnabled(end>0);if(!end)return;const a=i*2.399,r=.2+(i%5)*.20;mesh.position.set(Math.cos(a)*r,2.7-((end*.65+i*.11)%2.7),Math.sin(a)*r);mesh.rotation.set(age*(i%2?1:-1),a+age,age*.7);});
      }else if(event.kind==='heart'){
        root.position.setAll(0);const origin=sender.root.position.add(new B.Vector3(0,1.35,0)),end=target.root.position.add(new B.Vector3(0,1.35,0));
        const progress=Math.min(1,age/1.6),head=record.hearts[0];head.setEnabled(age<1.6);
        head.position.copyFrom(B.Vector3.Lerp(origin,end,progress));head.position.y+=Math.sin(progress*Math.PI)*1.1;
        record.hearts.slice(1).forEach((mesh,i)=>{mesh.setEnabled(age>=1.6);const t=Math.max(0,age-1.6),a=i*Math.PI*2/7;mesh.position.copyFrom(end).addInPlace(new B.Vector3(Math.cos(a)*t*.45,t*.24,Math.sin(a)*t*.45));mesh.scaling.setAll(Math.max(.05,1.4-t*.4));mesh.rotation.y=age;});
      }else if(event.kind==='bouquet'){
        const hand=target.limbs[0];hand.computeWorldMatrix(true);
        root.position.copyFrom(B.Vector3.TransformCoordinates(new B.Vector3(0,-.55,0),hand.getWorldMatrix()));
        root.rotationQuaternion=hand.absoluteRotationQuaternion?.clone()||B.Quaternion.Identity();
        record.holder.rotation.z=-.3+Math.sin(age*3)*.12;record.holder.rotation.x=-.5;
      }else if(event.kind==='cake'){
        const at=cakePosition(target.actor);root.position.set(at.x,at.y,at.z);
        record.flames.forEach((mesh,i)=>mesh.scaling.setAll(.85+.15*Math.sin(age*9+i)));
      }
    }
    for(const [id,record]of records)if(!events.has(id))dispose(record);
  }
  scene.onDisposeObservable.addOnce(()=>{for(const record of [...records.values()])dispose(record);});
  return {
    set(events){shared=(events||[]).filter(e=>Object.hasOwn(socialDurations,e.kind)&&Number.isFinite(e.start)&&e.seconds===socialDurations[e.kind]);},
    preview(kind,from,to,now,models){
      if(!['heart','bouquet','cake'].includes(kind)||!models.has(from)||!models.has(to))return false;
      // One local preview at a time; unrelated birthdays and existing performances stay intact.
      for(const record of [...records.values()])if(record.event.local)dispose(record);
      create({id:'local-social-'+ ++sequence,kind,from,to,start:now,seconds:socialDurations[kind],local:true});return true;
    },
    stop(){for(const record of [...records.values()])if(record.event.local)dispose(record);},
    render,
    activeCount(){return records.size;},
  };
}
