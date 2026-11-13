// Only the temporary side-screen shout changes. House screen/light programs keep running.
export function shoutCue(age){
 const burst=age<.65||age>1.4&&age<2.15||age>3.6&&age<4.35;
 return {scale:1+.075*Math.sin(age*Math.PI*4.8),ink:burst?(Math.floor(age/.12)%2? .60:1):.88+.12*Math.sin(age*6),spark:Math.floor(age/.1)%2===0};
}
export function shoutScreen(B,scene,text,nickname){
 const texture=new B.DynamicTexture('shout artwork',{width:1024,height:512},scene,false),ctx=texture.getContext();
 const material=new B.StandardMaterial('shout artwork',scene);material.disableLighting=true;material.emissiveTexture=texture;material.backFaceCulling=false;
 const mesh=B.MeshBuilder.CreatePlane('shout artwork',{width:12.8,height:5.3},scene);mesh.material=material;mesh.isPickable=false;
 let tick=-1;
 mesh.metadata={animateShout(age){
  const frame=Math.floor(age*30);if(frame===tick)return;tick=frame;const cue=shoutCue(age);
  ctx.clearRect(0,0,1024,512);ctx.fillStyle='#100c29';ctx.fillRect(0,0,1024,512);
  const hue=Math.floor(age/.7)%2?'#ec8dff':'#7cf4ff';ctx.lineWidth=cue.spark?12:5;ctx.strokeStyle=hue;ctx.strokeRect(15,15,994,482);
  ctx.globalAlpha=.35;ctx.lineWidth=3;
  for(let i=0;i<9;i++){const x=(age*110+i*141)%1200-100;ctx.beginPath();ctx.moveTo(x,32);ctx.lineTo(x-110,480);ctx.stroke();}
  ctx.globalAlpha=1;ctx.save();ctx.translate(512,242);ctx.scale(cue.scale,cue.scale);
  const chars=Array.from(text),lines=chars.length>10?[chars.slice(0,Math.ceil(chars.length/2)).join(''),chars.slice(Math.ceil(chars.length/2)).join('')]:[text];
  let font=138;while(font>76){ctx.font='900 '+font+'px sans-serif';if(lines.every(line=>ctx.measureText(line).width<=880))break;font-=2;}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=12;ctx.strokeStyle='#160a39';ctx.fillStyle=cue.spark?'#fff6ff':'#ffe2fa';ctx.globalAlpha=cue.ink;
  lines.forEach((line,i)=>{const y=(i-(lines.length-1)/2)*(font+10);ctx.strokeText(line,0,y);ctx.fillText(line,0,y);});ctx.restore();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 46px sans-serif';ctx.fillStyle='#b0faff';ctx.fillText(nickname,512,438,870);
  ctx.fillStyle=hue;
  for(let i=0;i<12;i++){if(!cue.spark&&i%2)continue;const x=42+(i*83+Math.sin(age*2+i)*15)%940,y=i%2?70:390;ctx.save();ctx.translate(x,y);ctx.rotate(age+i);ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(0,-3);ctx.lineTo(3,-13);ctx.lineTo(6,-3);ctx.lineTo(16,0);ctx.lineTo(6,3);ctx.lineTo(3,13);ctx.lineTo(0,3);ctx.closePath();ctx.fill();ctx.restore();}
  texture.update();
 }};
 mesh.metadata.animateShout(0);return mesh;
}
