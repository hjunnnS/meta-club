// A local receipt only: never included in room snapshots or sent to other viewers.
function makeBalloon(B,scene,personal){
 const texture=new B.DynamicTexture('private whisper receipt',{width:768,height:192},scene,false),ctx=texture.getContext();
 ctx.clearRect(0,0,768,192);ctx.fillStyle='#231838';ctx.fillRect(8,8,752,144);ctx.strokeStyle='#a5f5e8';ctx.lineWidth=5;ctx.strokeRect(8,8,752,144);
 ctx.beginPath();ctx.moveTo(335,149);ctx.lineTo(382,184);ctx.lineTo(425,149);ctx.closePath();ctx.fill();
 ctx.font='bold 54px sans-serif';ctx.fillStyle='#e5fff8';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(personal?'체험 · 귓속말 보냄':'귓속말 보냈어요',384,80,700);
 texture.update();
 const material=new B.StandardMaterial('private whisper receipt',scene);material.disableLighting=true;material.diffuseTexture=texture;material.emissiveTexture=texture;texture.hasAlpha=true;material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;
 const mesh=B.MeshBuilder.CreatePlane('private whisper receipt',{width:2.5,height:.625},scene);mesh.material=material;mesh.billboardMode=B.Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false;return mesh;
}
export function privateWhisperFeedback(B,scene,glow,{balloonFactory=personal=>makeBalloon(B,scene,personal)}={}){
 let target=null,until=0,balloon=null;
 function clear(){if(balloon){glow?.removeExcludedMesh(balloon);const ink=balloon.material,texture=ink?.emissiveTexture;balloon.dispose();ink?.dispose();texture?.dispose();}balloon=null;target=null;}
 scene.onDisposeObservable.addOnce(clear);
 return {
  show(id,personal,now){if(typeof id!=='string'||!id)return;clear();target=id;until=now+2800;balloon=balloonFactory(personal);glow?.addExcludedMesh(balloon);},
  render(now,models){const model=models.get(target);if(!balloon)return;if(now>=until||!model){clear();return;}balloon.setEnabled(model.root.isEnabled());balloon.position.copyFrom(model.root.position);balloon.position.y+=2.32+(model.actor.seat!=null?-.28:0);balloon.visibility=Math.min(1,(until-now)/250);},
  clear,
  active(){return Boolean(balloon);},
 };
}
