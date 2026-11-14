// Incoming only, local to the recipient: never put private text in public snapshots.
function makeBalloon(B,scene,personal,text,sender){
 const texture=new B.DynamicTexture('private whisper receipt',{width:768,height:320},scene,false),ctx=texture.getContext();
 ctx.clearRect(0,0,768,320);ctx.fillStyle='#231838';ctx.fillRect(8,8,752,264);ctx.strokeStyle='#a5f5e8';ctx.lineWidth=5;ctx.strokeRect(8,8,752,264);
 ctx.beginPath();ctx.moveTo(335,269);ctx.lineTo(382,312);ctx.lineTo(425,269);ctx.closePath();ctx.fill();
 ctx.fillStyle='#a5f5e8';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 32px sans-serif';
 ctx.fillText((personal?'체험 · ':'')+(sender||'상대')+'님의 귓속말',384,46,700);
 ctx.font='bold 52px sans-serif';ctx.fillStyle='#ffffff';
 const message=String(text||'귓속말이 도착했습니다.'),lines=[];let line='';
 for(const char of message){if(ctx.measureText(line+char).width>680){lines.push(line);line='';}line+=char;}
 if(line)lines.push(line);
 for(let i=0;i<Math.min(3,lines.length);i++)ctx.fillText(lines[i]+(i===2&&lines.length>3?'…':''),384,112+i*52,700);
 texture.update();
 const material=new B.StandardMaterial('private whisper receipt',scene);material.disableLighting=true;material.diffuseTexture=texture;material.emissiveTexture=texture;texture.hasAlpha=true;material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;
 // This recipient-only annotation draws after the club, without altering its lights.
 material.disableDepthWrite=true;material.depthFunction=B.Constants.ALWAYS;
 const mesh=B.MeshBuilder.CreatePlane('private whisper receipt',{width:2.5,height:1.04},scene);mesh.material=material;mesh.renderingGroupId=3;mesh.billboardMode=B.Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false;return mesh;
}
export function privateWhisperFeedback(B,scene,glow,{balloonFactory=(personal,text,sender)=>makeBalloon(B,scene,personal,text,sender)}={}){
 let target=null,until=0,balloon=null;
 function clear(){if(balloon){glow?.removeExcludedMesh(balloon);const ink=balloon.material,texture=ink?.emissiveTexture;balloon.dispose();ink?.dispose();texture?.dispose();}balloon=null;target=null;}
 scene.onDisposeObservable.addOnce(clear);
 return {
  show(id,personal,now,text,sender){if(typeof id!=='string'||!id)return;clear();target=id;until=now+8000;balloon=balloonFactory(personal,text,sender);glow?.addExcludedMesh(balloon);},
  render(now,models){
   const model=models.get(target);if(!balloon)return;if(now>=until||!model){clear();return;}
   balloon.setEnabled(model.root.isEnabled());
   const head=model.near?.getChildMeshes().find(mesh=>mesh.name==='head');
   if(head){head.computeWorldMatrix(true);const bounds=head.getBoundingInfo();balloon.position.copyFrom(bounds.boundingSphere.centerWorld);balloon.position.y=bounds.boundingBox.maximumWorld.y;}
   else{balloon.position.copyFrom(model.root.position);balloon.position.y+=1.82+(model.actor.seat!=null?-.28:0);}
   const camera=scene.activeCamera,engine=scene.getEngine();let scale=1;
   if(camera){
    const distance=B.Vector3.Distance(camera.globalPosition||camera.position,balloon.position);
    const height=engine.getRenderHeight(),width=engine.getRenderWidth();
    const pixels=Math.min(230,width*.40);
    scale=Math.max(1,distance*2*Math.tan(camera.fov/2)*pixels/Math.max(1,height)/2.5);
   }
   balloon.scaling.setAll(scale);balloon.position.y+=.14+.52*scale;
   balloon.visibility=Math.min(1,(until-now)/400);
  },
  clear,
  active(){return Boolean(balloon);},
 };
}
