const params = new URLSearchParams(location.search);
const engineName = params.get('engine') || 'babylon';
const canvas = document.querySelector('canvas');
const status = document.querySelector('#status');
const select = document.querySelector('#engine');
select.value = engineName;
select.onchange = () => location.search = '?engine=' + select.value;
const aiIds = [3,16,29,42,55];
const actorName = i => 'actor'+String(i).padStart(2,'0');
const jointNames = ['hips','chest','head','LShoulder','LElbow','LHip','LKnee','RShoulder','RElbow','RHip','RKnee'];
const paths = window.assetPaths || {
  stage:'../stage/edm-empty.glb', crowd:'crowd.glb',
  babylon:'vendor/babylon.js', loaders:'vendor/babylonjs.loaders.min.js', playcanvas:'./vendor/playcanvas.min.mjs'
};
async function script(src){
  await new Promise((resolve,reject)=>{const el=document.createElement('script');el.onload=resolve;el.onerror=reject;el.src=src;document.head.append(el);});
}
// A colour-ID pass uses the same skinned bodies and depth buffer, outside timed frames.
function idRGB(i) {
  if(i<0) return [0,0,0];
  const ai=aiIds.indexOf(i);
  return ai<0?[.16+.065*(i%12),.24+.1*Math.floor(i/12),0]:[0,0,.22+ai*.14];
}
function idOf(name){const m=/^actor(\d+)_body$/.exec(name);return m?Number(m[1]):-1;}
async function babylon(){
  await script(paths.babylon);await script(paths.loaders);
  const B=BABYLON, engine=new B.Engine(canvas,false,{preserveDrawingBuffer:true,stencil:true},false);
  engine.setSize(1920,1080);
  const scene=new B.Scene(engine);scene.useRightHandedSystem=true;
  const bg=new B.Color4(.09,.12,.17,1);scene.clearColor=bg;
  scene.ambientColor=new B.Color3(0,0,0);
  const sun=new B.DirectionalLight('key',new B.Vector3(.4,-1,-.6),scene);
  const fill=new B.DirectionalLight('fill',new B.Vector3(-.4,-.55,.9),scene);fill.intensity=.7;
  const cam=new B.FreeCamera('review',B.Vector3.Zero(),scene);
  cam.fov=Math.PI/3;cam.minZ=.1;cam.maxZ=120;
  for(const url of [paths.stage,paths.crowd])await B.SceneLoader.ImportMeshAsync('','',url,scene,null,'.glb');
  await scene.whenReadyAsync();
  const lookup=new Map([...scene.transformNodes,...scene.meshes].map(n=>[n.name,n]));
  const renderables=scene.meshes.filter(m=>m.getTotalVertices());
  const originals=renderables.map(m=>m.material);
  const masks=new Map();
  function mask(id){
    if(!masks.has(id)){const m=new B.StandardMaterial('id'+id,scene);m.disableLighting=true;m.emissiveColor=new B.Color3(...idRGB(id));masks.set(id,m);}
    return masks.get(id);
  }
  return {
    gl:engine._gl,version:B.Engine.Version,
    node:name=>lookup.get(name),rotate:(n,x,y,z,w)=>n.rotationQuaternion.set(x,y,z,w),
    move:(n,y)=>n.position.y=y,
    camera:(p,t)=>{cam.position.set(...p);cam.setTarget(B.Vector3.FromArray(t));},
    draw:()=>scene.render(),
    mask:on=>{scene.clearColor=on?new B.Color4(0,0,0,1):bg;renderables.forEach((m,j)=>m.material=on?mask(idOf(m.name)):originals[j]);},
    ready:()=>scene.whenReadyAsync()
  };
}
async function playcanvas(){
  const pc=await import(paths.playcanvas);
  const app=new pc.Application(canvas,{graphicsDeviceOptions:{alpha:false,antialias:false,preserveDrawingBuffer:true}});
  app.setCanvasResolution(pc.RESOLUTION_FIXED,1920,1080);
  app.scene.ambientLight=new pc.Color(0,0,0);
  const sun=new pc.Entity();sun.addComponent('light',{type:'directional',intensity:1,castShadows:false});
  const rotation=new pc.Quat().setFromDirections(new pc.Vec3(0,-1,0),new pc.Vec3(.4,-1,-.6).normalize());
  sun.setRotation(rotation);app.root.addChild(sun);
  const fill=new pc.Entity();fill.addComponent('light',{type:'directional',intensity:.7,castShadows:false});
  fill.setRotation(new pc.Quat().setFromDirections(new pc.Vec3(0,-1,0),new pc.Vec3(-.4,-.55,.9).normalize()));app.root.addChild(fill);
  const cam=new pc.Entity(),bg=new pc.Color(.09,.12,.17);
  cam.addComponent('camera',{fov:60,nearClip:.1,farClip:120,clearColor:bg});app.root.addChild(cam);
  for(const url of [paths.stage,paths.crowd]){
    const asset=await new Promise((ok,no)=>app.assets.loadFromUrlAndFilename(url,'scene.glb','container',(err,a)=>err?no(err):ok(a)));
    app.root.addChild(asset.resource.instantiateRenderEntity());
  }
  const instances=app.root.findComponents('render').flatMap(c=>c.meshInstances);
  const originals=instances.map(m=>m.material),masks=new Map();
  function mask(id){
    if(!masks.has(id)){const m=new pc.StandardMaterial();m.useLighting=false;m.diffuse=new pc.Color(0,0,0);m.emissive=new pc.Color(...idRGB(id));m.update();masks.set(id,m);}
    return masks.get(id);
  }
  return {
    gl:app.graphicsDevice.gl,version:pc.version,node:name=>app.root.findByName(name),
    rotate:(n,x,y,z,w)=>n.setLocalRotation(x,y,z,w),move:(n,y)=>n.setLocalPosition(n.getLocalPosition().x,y,n.getLocalPosition().z),
    camera:(p,t)=>{cam.setPosition(...p);cam.lookAt(...t);},draw:()=>app.render(),
    mask:on=>{cam.camera.clearColor=on?new pc.Color(0,0,0):bg;instances.forEach((m,j)=>m.material=on?mask(idOf(m.node.name)):originals[j]);},
    ready:async()=>{}
  };
}
async function init(){
  const api=await (engineName==='playcanvas'?playcanvas():babylon());
  const gl=api.gl,info=gl.getExtension('WEBGL_debug_renderer_info');
  const actors=Array.from({length:65},(_,i)=>jointNames.map(n=>api.node(actorName(i)+'_'+n)));
  if(actors.some(a=>a.some(j=>!j)))throw Error('누락된 군무 관절');
  let view='floor',manual=params.has('test'),start=performance.now();
  function draw(t){
    const phase=t*Math.PI*2*2;
    for(let i=0;i<actors.length;i++){
      const joints=actors[i],ai=aiIds.indexOf(i);
      const p=phase+((i%3)-1)*.08+(ai>=0&&ai<3?.27:0),beat=Math.sin(p),sway=Math.sin(p*.5);
      api.move(joints[0],.938+.035*(1-Math.cos(p*2)));
      for(let j=0;j<joints.length;j++){
        let angle,axis;
        if(j===0||j===1||j===2){angle=(j===0?.15:j===1?-.22:.08)*sway;axis=1;}
        else{
          const side=j<=6?-1:1,part=(j-3)%4;
          axis=part<2?2:0;
          angle=part===0?side*(.65+.52*beat):part===1?side*(.55+.33*sway):part===2?.21*side*beat:.18+.15*beat;
          if(ai>=3&&part===0&&Math.floor(t/2)%2===1) angle+=side*.65;
        }
        const q=Math.sin(angle/2);api.rotate(joints[j],axis===0?q:0,axis===1?q:0,axis===2?q:0,Math.cos(angle/2));
      }
    }
    const sweep=Math.sin(t*Math.PI/3);
    const p=view==='floor'?[sweep*.65,2.6,9.6]:[10.1,5.65,-13+sweep*.65];
    api.camera(p,view==='floor'?[0,1.2,-1.7]:[0,1.0,0]);api.draw();
  }
  async function visible(t){
    api.mask(true);draw(t);await api.ready();draw(t);
    const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const people=new Map(),guests=new Map();
    for(let i=0;i<pixels.length;i+=4){
      const [r,g,b]=pixels.subarray(i,i+3);
      const group=(g>10&&r>10&&b<4)?people:(b>10&&g<4&&r<4)?guests:null;
      if(group){const key=(r<<16)|(g<<8)|b;group.set(key,(group.get(key)||0)+1);}
    }
    const count=m=>[...m.values()].filter(n=>n>=4).length;
    api.mask(false);draw(t);await api.ready();
    return {avatars:count(people),ai:count(guests)};
  }
  function setView(v){view=v;start=performance.now();draw(.5);}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  function loop(now){draw((now-start)/1000);requestAnimationFrame(loop);}
  window.trial={draw,setView,visible,version:api.version,renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unknown',
    width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,samples:gl.getParameter(gl.SAMPLES)};
  draw(.5);status.textContent='금색 AI 표식 · 배경형 3 / 반응형 2';
  if(!manual)requestAnimationFrame(loop);
}
init().catch(e=>{window.failure=String(e);status.textContent=String(e);});
