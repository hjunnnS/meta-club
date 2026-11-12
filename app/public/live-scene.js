import { ceilingLights, musicSpeakers, strobeAccents, strobeAccentCue, accentDurations, movingLightPreview } from './ceiling-lights.js';
import { clubAmbience, strobeDurations } from './ambience.js';
import {activityFeedback} from './activity-feedback.js';
import {sceneLook} from './scene-look.js';
import { rhythmFloor } from './rhythm-floor.js';
import { playlistPosition, trackBeat, musicDynamics } from './music.js';
import { effects, eventPlayer, ledScreen, houseScreen, houseLights, peripheralTests, peripheralCue, beamPulse } from '/stage/festival/events.js';
import { permittedPath, edmCameraDistance, edmSeats, edmStage, edmBalcony, edmUpperRoute, edmStairRoute } from './edm-layout.js';
import { dances, danceCamera, animateDance } from './free-dance.js';
import { avatarFactory, playerView, staffNPC, animateStaff } from './avatar.js';
export function startLiveScene({
  B,
  cam,
  scene,
  engine,
  canvas,
  glow,
  eyeHeight,
  joystick,
  navigate,
  cancelWalk,
  pickDestination,
  lockInput,
  place,
}) {
  const venueMeshes=scene.meshes.filter(mesh=>mesh.getTotalVertices()&&mesh.isEnabled());
  const send = (kind, data) => parent.postMessage({ kind, data }, location.origin);
  const models = new Map(),
    make = avatarFactory(B, scene, glow);
  let epoch = Date.now(),
    offset = 0;
  const feedback=activityFeedback(B,scene);
  const renderCeiling = ceilingLights(B,scene);
  const renderSpeakers = musicSpeakers(B,scene);
  const renderAccents = strobeAccents(B,scene);
  let accentPreview=null;
  const renderMovingPreview=movingLightPreview(B,scene);
  let movingPreview=null;
  const floorStrobe={active:false,on:0};
  const renderAmbience = clubAmbience(B,scene,(active,on)=>{floorStrobe.active=active;floorStrobe.on=on;});
  let strobePreviewStarted = -Infinity;
  let strobePreviewPattern = 'transition';
  let peripheralPreview=null;
  function activePeripheralPreview() {
    if(!peripheralPreview)return null;
    const age=(performance.now()-peripheralPreview.start)/1000;
    const duration=peripheralPreview.kind==='strobe-hold'?peripheralPreview.duration:peripheralTests[peripheralPreview.kind];
    if(age>=duration+.5){peripheralPreview=null;return null;}
    return {kind:peripheralPreview.kind,age};
  }
  let spectrum = [], spectrumAt = 0, outputClock=null;
  let arrangementLevel=1, supportLevel=1, floorLevel=.68, ambientLevel=.23, decorLevel=.22, beamLevel=.48, whiteLevel=0;
  const renderFloor = rhythmFloor(B, scene);
  const renderHouseLights = houseLights(B, scene);
  const ambient = scene.getLightByName('ambient');
  if (ambient) ambient.intensity = 0.52;
  let tracks = [], visualTrack = null, audibleTrack = null, musicStartBeat = null, firstLaserAt = null;
  const calmBeats = matchMedia('(prefers-reduced-motion: reduce)');
  let fastFlash = false, otherWands = true;
  // One small broadcast target films the existing animated models, excluding the screen itself.
  const broadcastCamera = new B.FreeCamera('EDM broadcast camera', B.Vector3.Zero(), scene);
  broadcastCamera.minZ = .08;
  broadcastCamera.fov = .72;
  const broadcast = new B.RenderTargetTexture('EDM live broadcast', {width: 768, height: 288}, scene);
  broadcast.activeCamera = broadcastCamera;
  broadcast.clearColor = new B.Color4(.025, .012, .065, 0);
  broadcast.renderList = [];
  broadcast.refreshRate = 0;
  scene.customRenderTargets.push(broadcast);
  const dj = staffNPC(B,scene,make,'dj');
  const bartender = staffNPC(B,scene,make,'bartender');
  const wingCamera=new B.FreeCamera('EDM guest program camera',B.Vector3.Zero(),scene);
  wingCamera.minZ=.08;wingCamera.fov=.85;
  const wingBroadcast=new B.RenderTargetTexture('EDM guest program',{width:512,height:288},scene);
  wingBroadcast.activeCamera=wingCamera;wingBroadcast.clearColor=new B.Color4(.025,.012,.065,0);
  wingBroadcast.renderList=[];wingBroadcast.refreshRate=0;scene.customRenderTargets.push(wingBroadcast);
  const updateBoard = houseScreen(B, scene, broadcast,wingBroadcast);
  let nextWingBroadcast=0,openingCountdown=null;
  let nextBroadcast = 0;

  const lookPrimary=B.Color3.White(),lookSecondary=B.Color3.White();
  // Overlays follow the existing booth face and the two lips flanking its access ramp.
  function lightStrip(name, x, y, z, width, height) {
    const mesh = B.MeshBuilder.CreateBox(name, {width, height, depth: .032}, scene);
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    const ink = new B.StandardMaterial(name, scene);
    ink.disableLighting = true;
    mesh.material = ink;
    mesh.setEnabled(false);
    return mesh;
  }
  const boothFace = lightStrip('Booth center fill', 0, 1.91, edmStage.booth.z+.91, 5.98, .79);
  const boothEnds = [-1, 1].map(side => lightStrip('Booth end glow', side*2.77, 1.91, edmStage.booth.z+.96, .45, .79));
  const stageLips = [-1, 1].map(side => lightStrip('Stage lip cue', side*4.225, 1.15, -9.985, 4.05, .34));
  const stageRelays=[];
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const z=(edmStage.booth.z+1.26)*(1-i/5)+(-10.35)*(i/5);
    const mesh=lightStrip('Stage floor light relay',side*1.8,1.365,z,.22,.025);
    mesh.scaling.z=.48/.032;stageRelays.push({mesh,index:i});
  }
  function illuminate(mesh, color, level) {
    mesh.setEnabled(level > 0);
    if (level <= 0) return;
    mesh.material.emissiveColor.copyFrom(color);
    mesh.material.alpha = level * (calmBeats.matches ? .4 : .92);
  }
  const stageEvents = eventPlayer(B, scene, () => Date.now() + offset, () => fastFlash);
  const view = playerView(B, scene, cam, canvas, eyeHeight, document.body, { followDistance: 7.1, followLift: 0.47, followFov: 1.23, maxDistance: 24, cameraLimit: edmCameraDistance, arrivalSeconds: 2.5, independentLook: true, entryTarget: [edmStage.dj.x,edmStage.dj.y,edmStage.dj.z] });
  const viewDance = danceCamera(B, scene);
  let own,
    mode = 'auto',
    low = false,
    lastSent = 0,
    tally = 0,
    frames = 0,
    moveBefore = null,
    activeSeat = null, riding = false;
  function quality(value) {
    low = value;
    glow.isEnabled = !low;
    engine.setHardwareScalingLevel(low ? 1.5 : 1);
  }
  let states = ['CLOSED', 'CLOSED'],
    dancers = 0;
  const washes = scene.lights
    .filter((l) => l.name.startsWith('Stage wash'))
    .map((light) => ({ light, base: light.intensity }));
  // Reuse three existing stage lights, isolating their illumination to the adult DJ during broadcast.
  const djMeshes=dj.near.getChildMeshes();
  let djLightLevel=0;
  const djFocusLights=washes.slice(0,3).map(({light,base},i)=>{
    const tint=B.Color3.FromHexString(['#fff1d8','#b9e6ff','#d4b9ff'][i]);
    const origin=B.Vector3.FromArray(edmStage.focusOrigins[i]);
    const material=new B.StandardMaterial('DJ focus beam '+i,scene);
    material.disableLighting=true;material.emissiveColor=tint;material.alpha=0;material.backFaceCulling=false;
    const beam=B.MeshBuilder.CreateCylinder('DJ focus cone '+i,{height:1,diameterTop:.10,diameterBottom:.82,tessellation:12,cap:B.Mesh.NO_CAP},scene);
    beam.material=material;beam.rotationQuaternion=new B.Quaternion();beam.isPickable=false;beam.setEnabled(false);
    const target=new B.Vector3(edmStage.dj.x,2.9,edmStage.dj.z),axis=target.subtract(origin);
    beam.position.copyFrom(origin).addInPlace(axis.scale(.5));beam.scaling.y=axis.length();
    B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,axis.normalize(),beam.rotationQuaternion);
    return {light,base,tint,origin,beam,material,position:light.position.clone(),color:light.diffuse.clone(),
      excluded:light.excludedMeshes.slice(),included:light.includedOnlyMeshes.slice()};
  });
  // Dim only a foreground beam whose projected line crosses the screen or featured hologram.
  const beamClearance=new WeakMap(),projectionIdentity=B.Matrix.Identity();
  function protectedRectangle(min,max,viewport){
    const points=[];
    for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
      const p=B.Vector3.Project(new B.Vector3(x,y,z),projectionIdentity,scene.getTransformMatrix(),viewport);
      if(p.z>0&&p.z<1)points.push(p);
    }
    if(!points.length)return null;
    return {left:Math.min(...points.map(p=>p.x))-8,right:Math.max(...points.map(p=>p.x))+8,
      top:Math.min(...points.map(p=>p.y))-8,bottom:Math.max(...points.map(p=>p.y))+8};
  }
  function crossesRectangle(a,b,r){
    if(!r||a.z<=0||b.z<=0||a.z>=1&&b.z>=1)return false;
    let near=0,far=1;const dx=b.x-a.x,dy=b.y-a.y;
    for(const [p,q]of [[-dx,a.x-r.left],[dx,r.right-a.x],[-dy,a.y-r.top],[dy,r.bottom-a.y]]){
      if(Math.abs(p)<1e-6){if(q<0)return false;continue;}
      const t=q/p;if(p<0)near=Math.max(near,t);else far=Math.min(far,t);
      if(near>far)return false;
    }
    return true;
  }
  const strips = scene.materials
    .filter((m) => ['Orchid LED', 'Ice LED', 'Rose LED', 'Ultraviolet guide', 'Glacier guide', 'Fuchsia guide', 'LED / chromatic vortex'].includes(m.name))
    .map((material) => ({ material, base: material.emissiveColor.clone() }));
  // The west-side reactive guest already carries a wand beside the entry group.
  const wandGuest = 'ai-3';
  let responders = [];
  function onSnapshot({ actors, self, zones, stageEvent, nextPerformance }) {
    if(nextPerformance?.id==='scheduled-0'&&nextPerformance.kind==='laser')firstLaserAt=nextPerformance.start;
    if(movingPreview||activePeripheralPreview())stageEvents.stop();else stageEvents.set(stageEvent);
    if (zones) states = zones;
    dancers = actors.filter((a) => a.action === 'dance' || dances.has(a.action)).length;
    const caller = actors.find(a => a.id === wandGuest && a.wand && a.trainSlot == null);
    responders = caller ? actors.filter(a => a.ai && a.id !== caller.id && a.trainSlot == null && dances.has(a.action))
      .sort((a, b) => Math.hypot(a.x-caller.x, a.z-caller.z) - Math.hypot(b.x-caller.x, b.z-caller.z))
      .slice(0, 2).map(a => a.id) : [];
    own = self;
    const remaining = new Set(models.keys());
    for (const a of actors) {
      let model = models.get(a.id);
      if (!model) {
        model = make(a, a.id === wandGuest);
        models.set(a.id, model);
      }
      const previous=model.actor;
      if(previous&&a.id===self){
        if(a.wand&&!previous.wand)feedback.start(a.id,'wand');
        else if(a.action!==previous.action&&dances.has(a.action))feedback.start(a.id,'dance');
      }
      model.actor = {...a};
      if (a.id === self) {
        riding = a.trainSlot > 0;
        if (riding) {cancelWalk();place(a);}
        const activity = a.trainSlot == null && dances.has(a.action) ? viewDance(a) : null;
        view.actor(model, activity, a.seat != null);
      }
      remaining.delete(a.id);
    }
    for (const id of remaining) {
      models.get(id).dispose();
      models.delete(id);
    }
  }
  let preview, speakerCamera, connected=true, gameActive=false;
  function speakerView(kind='speakers'){
    if(speakerCamera)return;
    cancelWalk();
    const positions={speakers:[[-12.5,3.6,12],[-19.2,2,6.5]],
      bartender:[[-11.3,1.95,14.7],[-13.6,1.4,18.1]],dj:[[3.9,4.0,edmStage.booth.z+3.7],[0,2.75,edmStage.booth.z]]};
    const [eye,target]=positions[kind]||positions.speakers;
    speakerCamera=new B.FreeCamera('Club observation',B.Vector3.FromArray(eye),scene);
    speakerCamera.setTarget(B.Vector3.FromArray(target));
    view.preview(speakerCamera);
    const close=document.createElement('button');
    close.textContent=kind==='speakers'?'계단 보기 종료':'직원 보기 종료';
    close.style.cssText='position:fixed;top:15px;left:15px;z-index:3;background:#21172bdd;color:white;padding:10px;border:1px solid #ffffff66;border-radius:8px';
    document.body.append(close);
    close.onclick=()=>{view.preview(null);speakerCamera.dispose();speakerCamera=null;close.remove();canvas.focus();};
  }
  function showPreview(data) {
    cancelWalk();
    if (preview) {
      view.preview(null);
      preview.camera.dispose();
      preview.screen.dispose(false, true);
      preview = null;
    }
    if (!data) return;
    const screen = ledScreen(B, scene, data.message);
    const camera = new B.FreeCamera('LED preview camera', new B.Vector3(0, 4.8, -6), scene);
    camera.setTarget(screen.position);
    view.preview(camera);
    preview = { screen, camera };
  }
  window.addEventListener('message', (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const { kind, data } = e.data || {};
    if (kind === 'clock') {
      if(epoch!==data.epoch){musicStartBeat=null;firstLaserAt=null;}
      epoch = data.epoch;
      tracks = data.tracks || [];
      offset = data.offset;
    }
    if (kind === 'audible-track') {if(audibleTrack!==data)musicStartBeat=null;audibleTrack = data;outputClock=null;}
    if(kind==='music-output-clock'){
      if(data?.playing&&data.id===audibleTrack&&Number.isFinite(data.time)&&Number.isFinite(data.sentAt))
        outputClock={id:data.id,time:data.time+Math.max(0,Math.min(.15,(Date.now()-data.sentAt)/1000)),at:performance.now()};
      else outputClock=null;
    }
    if(kind==='visual-track')visualTrack=data;
    if(kind==='opening-countdown')openingCountdown=data;
    if (kind === 'speaker-view') speakerView();
    if (kind === 'staff-view' && ['dj','bartender'].includes(data)) speakerView(data);
    if(kind==='moving-preview'&&['start','stop'].includes(data)){
      movingPreview=data==='start'?{start:performance.now(),anchor:null}:null;
      accentPreview=null;peripheralPreview=null;stageEvents.stop();strobePreviewStarted=-Infinity;
      send('gate-notice',data==='start'?'무빙 조명 시험: 펼치기 → 교차 → 순차 이동 → 모으기 · 16마디 후 자동 종료':'무빙 조명 시험 종료');
    }
    if(['accent-preview','peripheral-preview','strobe-preview','led-preview'].includes(kind))movingPreview=null;
    if(kind==='accent-preview' &&Object.hasOwn(accentDurations,data)){
      accentPreview={kind:data,start:performance.now()};
      peripheralPreview={kind:'strobe-hold',start:accentPreview.start,duration:accentDurations[data]};
      stageEvents.stop();strobePreviewStarted=-Infinity;
      send('gate-notice',({curtain:'벽 레이저 커튼: 양쪽 벽을 따라 내려오는 흰색·노랑·하늘색 광선입니다.',fan:'부채꼴 빛: 무대 양옆에서 객석 머리 위로 펼쳐지는 넓은 빛입니다.',gobo:'회전 무늬: 중앙 플로어 양옆 바닥과 양쪽 벽에서 회전하는 원·격자 무늬입니다.'})[data]);
    }
    if(kind==='peripheral-preview'&&Object.hasOwn(peripheralTests,data)){
      accentPreview=null;
      peripheralPreview={kind:data,start:performance.now()};stageEvents.stop();strobePreviewStarted=-Infinity;
    }
    if (kind === 'strobe-preview' && Object.hasOwn(strobeDurations,data)) {
      accentPreview=null;
      strobePreviewPattern = data;
      strobePreviewStarted = performance.now();
      peripheralPreview={kind:'strobe-hold',start:strobePreviewStarted,duration:strobeDurations[data]};
      stageEvents.stop();
    }
    if (kind === 'music-spectrum' && Array.isArray(data) && data.length === 12) {
      spectrum = data.map(value => Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0);
      spectrumAt = performance.now();
    }
    if (kind === 'other-wands') otherWands = data;
    if (kind === 'fast-flash') fastFlash = data === true;
    if (kind === 'led-preview') showPreview(data);
    if (kind === 'actors') onSnapshot(data);
    if(kind==='game-active'){gameActive=data===true;lockInput(gameActive);cancelWalk();}
    if (kind === 'connection-state') {
      connected=data===true;
      if(!connected){cancelWalk();joystick(0,0);stageEvents.stop();}
    }
    if (kind === 'place') {
      feedback.seat(null);
      activeSeat = data.seat;
      place(data);
      moveBefore = null;
    }
    if (kind === 'quality') {
      mode = data;
      if (mode !== 'auto') quality(mode === 'low');
    }
    if (kind === 'resume') {
      engine.resize();
      joystick(0, 0);
    }
  });
  const pad = document.createElement('button');
  pad.textContent = '이동';
  pad.ariaLabel = '이동 조이스틱';
  pad.style.cssText =
    'position:fixed;bottom:15px;left:15px;width:74px;height:74px;border:1px solid #ddd8;border-radius:50%;background:#21172ab8;touch-action:none;color:white;';
  pad.hidden = !matchMedia('(any-pointer: coarse)').matches;
  document.body.append(pad);
  let padId = null,
    lookId = null,
    lastX = 0,
    lastY = 0;
  function stick(e) {
    const r = pad.getBoundingClientRect();
    joystick(
      Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 30)),
      Math.max(-1, Math.min(1, (r.top + r.height / 2 - e.clientY) / 30)),
    );
  }
  pad.onpointerdown = (e) => {
    if (padId !== null) return;
    padId = e.pointerId;
    pad.setPointerCapture(padId);
    stick(e);
  };
  pad.onpointermove = (e) => {
    if (e.pointerId === padId) stick(e);
  };
  pad.onlostpointercapture = () => {
    padId = null;
    joystick(0, 0);
  };
  canvas.onpointerdown = (e) => {
    if (lookId !== null) return;
    canvas.focus();
    lookId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(lookId);
  };
  canvas.onpointermove = (e) => {
    if (e.pointerId !== lookId) return;
    cam.rotation.y -= (e.clientX - lastX) * 0.003;
    cam.rotation.x = Math.max(-1.35, Math.min(1.35, cam.rotation.x + (e.clientY - lastY) * 0.003));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  canvas.onlostpointercapture = () => {
    lookId = null;
  };
  let seatTap = null,hoverAt=0;
  function pickedSeat(hit){
    if(!hit?.hit)return -1;
    const names=[hit.pickedMesh.name,hit.pickedMesh.parent?.name];
    const balcony=names.some(name=>/^VIP sofa (base|cushion|back|arm|return)$/.test(name));
    const booth=names.some(name=>/^Wall booth (seat|table|back|base)$/.test(name));
    if(!balcony&&!booth)return -1;
    let index=-1,best=Infinity;
    edmSeats.forEach((s,i)=>{
      if(balcony?!s.balcony:!s.table)return;
      const d=Math.hypot(s.x-hit.pickedPoint.x,s.z-hit.pickedPoint.z);
      if(d<best){index=i;best=d;}
    });
    return index;
  }
  canvas.addEventListener('pointerleave',()=>feedback.seat(null));
  canvas.addEventListener('pointermove',e=>{
    if(e.buttons||performance.now()-hoverAt<80)return;hoverAt=performance.now();
    const r=canvas.getBoundingClientRect();
    const hit=pickDestination((e.clientX-r.left)*engine.getRenderWidth()/r.width,(e.clientY-r.top)*engine.getRenderHeight()/r.height);
    const index=pickedSeat(hit),occupied=[...models.values()].some(m=>m.actor.seat===index);
    const can=index>=0&&!occupied&&activeSeat===null&&!riding&&!speakerCamera&&connected&&!gameActive;
    feedback.seat(can?edmSeats[index]:null);canvas.style.cursor=can?'pointer':'grab';
    canvas.title=can?(edmSeats[index].label||edmSeats[index].table+'번 테이블')+' · 클릭하면 걸어가 앉습니다.':'';
  });
  canvas.addEventListener('pointerdown', e=>{
    seatTap=e.button===0?{id:e.pointerId,x:e.clientX,y:e.clientY,drag:false}:null;
  });
  canvas.addEventListener('pointermove', e=>{
    if(seatTap?.id===e.pointerId&&Math.hypot(e.clientX-seatTap.x,e.clientY-seatTap.y)>6)seatTap.drag=true;
  });
  canvas.addEventListener('pointercancel', ()=>seatTap=null);
  canvas.addEventListener('pointerup', e=>{
    const tap=seatTap;seatTap=null;
    if(!tap||tap.id!==e.pointerId||tap.drag||activeSeat!==null||riding||speakerCamera||preview||!connected||gameActive)return;
    const bounds=canvas.getBoundingClientRect();
    const hit=pickDestination((e.clientX-bounds.left)*engine.getRenderWidth()/bounds.width,
      (e.clientY-bounds.top)*engine.getRenderHeight()/bounds.height);
    if(!hit?.hit)return;
    const point=hit.pickedPoint,names=[hit.pickedMesh.name,hit.pickedMesh.parent?.name];
    const selected=pickedSeat(hit);
    if(selected>=0){
      if([...models.values()].some(m=>m.actor.seat===selected)){
        send('gate-notice','이미 앉아 있는 자리입니다. 다른 의자를 선택해 주세요.');return;
      }
    }else if(!['Arena floor','Entry floor','Dance floor','DJ platform','DJ access','West dance zone','West deck ramp','West upper deck','U lounge floor','U lounge stair'].some(name=>names.includes(name)))return;
    const goal=selected>=0?edmSeats[selected].exit:point;
    const arrived=selected<0?null:()=>{
      send('move',{x:cam.position.x,y:cam.position.y-eyeHeight,z:cam.position.z,yaw:cam.rotation.y});
      send('seat-request',selected);
    };
    feedback.seat(selected>=0?edmSeats[selected]:null);
    const permit=(from,to)=>permittedPath(from,to,states);
    const failed=()=>send('gate-notice','걸어갈 수 있는 경로가 없습니다. 가까운 열린 바닥을 선택해 주세요.');
    const foot=cam.position.y-eyeHeight;
    const upperTarget=selected>=0?Boolean(edmSeats[selected].balcony):goal.y>3.5;
    if(upperTarget||foot>=3.95&&goal.y<1){
      const route=[];let upper={x:cam.position.x,y:foot,z:cam.position.z};
      if(upperTarget){
        if(foot<3.95){const ascent=edmStairRoute(upper,upper.x>0?1:-1);route.push(...ascent);upper=ascent.at(-1);}
        route.push(...edmUpperRoute(upper,selected>=0?edmSeats[selected].area:goal),goal);
      }else{
        const side=upper.x>0?1:-1,descent=edmStairRoute({x:0,y:0,z:0},side).reverse();
        route.push(...edmUpperRoute(upper,descent[0]),...descent,goal);
      }
      const advance=()=>{const next=route.shift();if(!next){arrived?.();return;}if(!navigate(next,advance,permit))failed();};
      advance();
    }else if(!navigate(goal,arrived,permit))failed();

  });
  window.addEventListener('blur', () => joystick(0, 0));
  window.addEventListener('resize', () => engine.resize());
  // Keep member names; give the nearest AI name priority when labels overlap.
  function arrangeNames() {
    const camera = scene.activeCamera;
    const viewport = camera.viewport.toGlobal(canvas.clientWidth, canvas.clientHeight);
    const transform = scene.getTransformMatrix();
    const names = [];
    for (const model of models.values()) {
      const center = model.label.getAbsolutePosition();
      const screen = B.Vector3.Project(center, B.Matrix.IdentityReadOnly, transform, viewport);
      if (screen.z < 0 || screen.z > 1) continue;
      const top = B.Vector3.Project(center.add(camera.getDirection(B.Axis.Y).scale(.17)),
        B.Matrix.IdentityReadOnly, transform, viewport);
      const halfHeight = Math.max(3, Math.abs(screen.y - top.y));
      names.push({model, x: screen.x, y: screen.y, h: halfHeight + 2,
        w: halfHeight * 1.55 / .34 + 3, distance: screen.z});
    }
    names.sort((a,b) => Number(a.model.actor.ai) - Number(b.model.actor.ai) || a.distance - b.distance);
    const kept = [];
    for (const name of names) {
      const overlaps = name.model.actor.ai && kept.some(other =>
        Math.abs(name.x - other.x) < name.w + other.w && Math.abs(name.y - other.y) < name.h + other.h);
      name.model.label.isVisible = !overlaps;
      if (!overlaps) kept.push(name);
    }
  }
  let nextNameLayout = 0;
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now(),
      dt = engine.getDeltaTime(),
      t = (Date.now() + offset - epoch) / 1000;
    // The track beat and all clients share the room epoch. Smooth washes
    // follow a four-beat phrase; the floor strips and dancers keep the same phase.
    const playback = playlistPosition(tracks, epoch, Date.now() + offset);
    // Audible device time drives local dance/light phase; server clock still owns show scheduling.
    if(playback&&outputClock?.id===playback.track.id&&now-outputClock.at<350){
      playback.time=(outputClock.time+(now-outputClock.at)/1000)%playback.track.duration;
      playback.phraseTime=playback.time;
    }
    const beats = trackBeat(playback, t);
    let movingBeat=null;
    if(movingPreview){
      const musicPlaying=playback&&playback.track.id===audibleTrack;
      if(movingPreview.anchor===null)movingPreview.anchor={beat:beats,playing:Boolean(musicPlaying),elapsed:musicPlaying?((beats%1)+1)%1:0};
      const anchor=movingPreview.anchor,age=(performance.now()-movingPreview.start)/1000;
      // Unwrap the music loop; if playback stops/starts, continue the test clock smoothly.
      if(musicPlaying&&anchor.playing){let step=beats-anchor.beat;if(step<0)step+=playback.track.duration*playback.track.bpm/60;anchor.elapsed+=Math.max(0,Math.min(2,step));}
      else anchor.elapsed+=Math.max(0,(age-(anchor.age||0)))*(musicPlaying?playback.track.bpm:132)/60;
      anchor.age=age;anchor.beat=beats;anchor.playing=Boolean(musicPlaying);movingBeat=anchor.elapsed;
      if(movingBeat>=64||age>40){movingPreview=null;movingBeat=null;send('gate-notice','무빙 조명 시험 종료 · 원래 연출로 복귀');}
    }
    const effectPreview=movingPreview?{kind:'strobe-hold',age:0}:activePeripheralPreview();
    const playing = playback && (playback.track.id === audibleTrack||playback.track.id === visualTrack);
    if(playing&&musicStartBeat===null)musicStartBeat=Math.ceil(Math.max(0,beats));
    const bpm=playback?.track.bpm||120;
    // Use the existing channel's first show time; do not reschedule it for the opening.
    const laserTime=firstLaserAt===null?((Math.ceil((30-(playback?.track.firstBeat||0))*bpm/240)*4)*60/bpm+(playback?.track.firstBeat||0)):(firstLaserAt-epoch)/1000;
    const laserBeat=(laserTime-(playback?.track.firstBeat||0))*bpm/60;
    const openingActive=Boolean(playing)&&t<laserTime&&t>=0&&!stageEvents.kind&&!preview&&!accentPreview&&!effectPreview;
    const openingSection=Math.floor(Math.max(0,beats)/16)%3;
    const openingGather=openingActive?Math.max(0,Math.min(1,(beats-(laserBeat-8))/8)):0;
    const startBeat=openingActive?beats-musicStartBeat:-1;
    const dynamics=musicDynamics(playback);
    const blend=1-Math.exp(-Math.min(dt,100)/350);
    arrangementLevel+=(dynamics.level-arrangementLevel)*blend;
    dynamics.level=arrangementLevel;
    const peripheralPlan=peripheralCue(beats,playback?.track.bpm||120,effectPreview,Boolean(playing),dynamics.level);
    const celebrating = stageEvents.kind === 'led';
    const strobing = stageEvents.strobing;
    const audioBands = performance.now()-spectrumAt<350 && audibleTrack ? spectrum : [];
    const musicEnergy = Math.min(1,((audioBands[0]||0)+(audioBands[1]||0)+(audioBands[2]||0))/3);
    const openingMotion=openingActive&&movingBeat===null;
    renderMovingPreview(movingBeat??(openingMotion?Math.max(0,beats):null),calmBeats.matches,musicEnergy,{
      opening:openingMotion,gather:openingGather,
      audience:[...models.values()].flatMap(model=>model.root.getChildMeshes()),
    });
    const previewAge = (performance.now()-strobePreviewStarted)/1000;
    // After either test, leave a normal-light gap before automatic accents resume.
    const smokeProtection=peripheralPlan.protectSmoke&&previewAge>=strobeDurations[strobePreviewPattern];
    const effectBlocksStrobe=Boolean(accentPreview)||(effectPreview&&effectPreview.kind!=='strobe-hold');
    const phrasePhase=((beats%32)+32)%32;
    const stageFocus=Boolean(stageEvents.kind&&stageEvents.kind!=='led');
    const boardFocus=Boolean(playing)&&(phrasePhase>=28||phrasePhase<2);
    const floorFocus=Boolean(playing)&&phrasePhase>=2&&phrasePhase<6;
    const supportTarget=stageFocus?.68:boardFocus?.72:floorFocus?.82:1;
    supportLevel+=(supportTarget-supportLevel)*blend;
    const roomPulse = renderAmbience(beats, audioBands, openingActive||strobing||Boolean(effectBlocksStrobe)||Boolean(smokeProtection)||((stageFocus||boardFocus)&&!effectPreview&&phrasePhase<1.5), Boolean(audibleTrack), playback?.track.bpm || 120, previewAge<strobeDurations[strobePreviewPattern]+1.6 ? previewAge : null, strobePreviewPattern,dynamics.level);
    const boardSegment=playing?Math.floor(Math.max(0,beats)%32/8):-1;
    const look=sceneLook(beats,Boolean(playing),dynamics.level,boardSegment===1||boardSegment===2);
    if(openingActive){
      const palettes=[['#8b74ff','#9deaff'],['#ff79d5','#79baff'],['#8edbff','#fff1c9']];
      [look.primary,look.secondary]=palettes[openingSection];
      look.floor=Math.max(look.floor,.70);look.decor=Math.max(look.decor,.38);
      look.openingSection=openingSection;look.openingGather=openingGather;
    }
    B.Color3.LerpToRef(lookPrimary,B.Color3.FromHexString(look.primary),blend,lookPrimary);
    B.Color3.LerpToRef(lookSecondary,B.Color3.FromHexString(look.secondary),blend,lookSecondary);
    look.primary=lookPrimary.toHexString();look.secondary=lookSecondary.toHexString();
    ambientLevel+=(look.ambient-ambientLevel)*blend;decorLevel+=(look.decor-decorLevel)*blend;
    beamLevel+=(look.beams-beamLevel)*blend;whiteLevel+=(look.white-whiteLevel)*blend;
    const floorTarget=look.floor*(stageFocus?.82:boardFocus?.88:1);
    floorLevel+=(floorTarget-floorLevel)*blend;
    Object.assign(look,{ambient:ambientLevel,decor:decorLevel,beams:beamLevel*supportLevel,
      white:whiteLevel*(stageFocus?.65:1),floor:floorLevel,support:supportLevel,
      protectedMeshes:[...djMeshes,...scene.meshes.filter(mesh=>/^EDM (house screen|wing screen (left|right))$/.test(mesh.name))]});
    renderCeiling(beats,strobing,musicEnergy,roomPulse,look);
    renderSpeakers(beats,audioBands,Boolean(playing),dt,calmBeats.matches);
    const accentAge=accentPreview?(performance.now()-accentPreview.start)/1000:0;
    if(accentPreview&&accentAge>=accentDurations[accentPreview.kind])accentPreview=null;
    const accentTest=accentPreview?{kind:accentPreview.kind,age:accentAge}:null;
    const accentCue=strobeAccentCue({beat:beats,bpm:playback?.track.bpm||120,playing:Boolean(playing),
      preview:accentTest,strobePreview:previewAge<strobeDurations[strobePreviewPattern]?{kind:strobePreviewPattern,age:previewAge}:null,
      overlap:stageEvents.kind&&stageEvents.kind!=='led'||peripheralPlan.laser>.5,
      protectSmoke:Boolean(smokeProtection),reduced:calmBeats.matches,arrangement:dynamics.level});
    if(openingActive){
      // Audience choreography leads; moving wall patterns support without filling the screen.
      const beds=[{curtain:.38,fan:.04,gobo:.20},{curtain:.16,fan:.10,gobo:.40},{curtain:.30,fan:.06,gobo:.24}];
      const bed=beds[openingSection],gain=(smokeProtection?.40:1)*(calmBeats.matches?.38:1);
      const gathering={curtain:.38,fan:.08,gobo:.24};
      for(const kind of ['curtain','fan','gobo'])accentCue[kind]=(bed[kind]*(1-openingGather)+gathering[kind]*openingGather)*gain;
      if(smokeProtection){accentCue.curtain=0;accentCue.fan=0;}
      accentCue.variant=openingSection;accentCue.gather=openingGather;accentCue.travel=0;
    }
    if(playing&&!accentTest&&!effectPreview){accentCue.fan*=.45;accentCue.gobo*=.70;}
    accentCue.pulse=calmBeats.matches?1:beamPulse(beats,bpm,accentTest?.kind==='curtain'?accentAge:null);
    const performancePhase=stageEvents.phase;
    const performancePriority=performancePhase&&performancePhase.kind!=='led'&&performancePhase.level<.75;
    if(!accentTest&&!effectPreview){accentCue.curtain*=supportLevel;accentCue.fan*=supportLevel;accentCue.gobo*=supportLevel;}
    if(movingPreview){accentCue.curtain=0;accentCue.fan=0;accentCue.gobo=0;}
    renderAccents(accentCue,beats,accentTest?.75:musicEnergy,calmBeats.matches,dt,!accentTest&&!effectPreview&&(stageFocus||boardSegment===1||boardSegment===2));
    if (ambient) ambient.intensity = (smokeProtection?.39:look.ambient) + roomPulse * 1.10;
    // The first beat of each four-beat bar accents both surfaces on the same frame.
    const barPhase = ((beats % 4) + 4) % 4;
    const accent = playing && beats >= 0 ? Math.max(0, 1 - barPhase / .78) * Math.min(1,dynamics.level*1.2) * (calmBeats.matches ? .3 : 1) : 0;
    // Every visual phrase restarts with the selected song at its loop boundary.
    const phraseBeat = playing ? (playback.phraseTime - (playback.track.firstBeat || 0)) * (playback.track.bpm || 120) / 60 : -1;
    const phase32 = phraseBeat % 32;
    const gather = openingActive?openingGather:phase32 >= 30 ? (phase32 - 30) / 2 : 0;
    const release = !openingActive && phraseBeat >= 32 && phase32 < 3 ? phase32 / 3 : -1;
    renderHouseLights(beats, !stageEvents.kind, preview||accentPreview ? -1 : release, playback?.track.bpm || 120, musicEnergy, strobing, effectPreview, Boolean(playing),dynamics.level,look);
    // Pick the upcoming phrase's color during the pickup and keep it through the release.
    const cue = {hex:look.primary,rgb:lookPrimary};
    const wallRelease = preview || celebrating ? -1 : release;
    // Times are measured in beats after the wall opens. Let neighboring surfaces overlap.
    const cueBeat = startBeat>=0&&startBeat<5.2?startBeat:!openingActive&&playing && phraseBeat >= 32 && !preview && !celebrating ? phase32 : -1;
    const ramp = (value, span) => Math.max(0, Math.min(1, value / span));
    boothFace.scaling.x = Math.max(.001, ramp(cueBeat - .10, .90));
    illuminate(boothFace, cue.rgb, ramp(cueBeat - .10, .18) * ramp(1.85 - cueBeat, .8));
    const endGlow = ramp(cueBeat - .86, .16) * ramp(4.2 - cueBeat, .75);
    for (const end of boothEnds) illuminate(end, cue.rgb, endGlow);
    for(const {mesh,index} of stageRelays){
      const age=cueBeat-(1.08+index*.14);
      illuminate(mesh,cue.rgb,ramp(age,.10)*ramp(.62-age,.30));
    }
    const lipGlow = ramp(cueBeat - 1.22, .28) * ramp(2.95 - cueBeat, .75);
    for (const lip of stageLips) illuminate(lip, cue.rgb, lipGlow);
    // Reuse the existing room pulse, including its OFF frames. The laser's
    // rapid section uses the same rounded 100ms phase as its own shutter.
    const tileStrobe=strobing?{active:true,on:Math.floor((Math.round((stageEvents.phase?.age||0)*1000)-7000)/100)%2===0?1:0}:floorStrobe;
    renderFloor(beats, celebrating, accent, cueBeat, cue.rgb, stageEvents.kind === 'laser' ? 1 : ['phoenix','whale','dragon','jellyfish','butterflies'].includes(stageEvents.kind) ? 2 : 0, roomPulse,look,Boolean(playing),musicEnergy,tileStrobe);
    updateBoard(playing ? playback.track.title : null, beats, !preview && !celebrating, Math.max(accent,startBeat>=0&&startBeat<.78?(1-startBeat/.78)*.85:0), gather, calmBeats.matches, phraseBeat, wallRelease, cue.hex, stageEvents.kind && stageEvents.kind !== 'led' ? effects[stageEvents.kind].label : null, strobing, roomPulse,look,openingCountdown?Math.max(0,Math.min(3,Math.ceil((openingCountdown.endsAt-Date.now())/1000))):0,'DJ · 음악 그래픽',audioBands);
    const phase = beats * Math.PI * 2,
      beatWave = Math.sin(phase);
    washes.forEach(({ light, base }, i) => {
      light.diffuse.copyFrom(i%2?lookSecondary:lookPrimary);
      light.intensity = base * (strobing ? .20 : .70+look.opening*.45+roomPulse*1.25) * (dancers ? 1 + 0.38 * Math.sin(phase / 4 + (i * Math.PI) / 2) : 1);
    });
    const djOnAir=Boolean(playing)&&[0,1,3].includes(boardSegment)&&!preview&&!celebrating;
    djLightLevel+=((djOnAir?1:0)-djLightLevel)*(1-Math.exp(-Math.min(dt,100)/220));
    djFocusLights.forEach(({light,base,tint,origin,beam,material,position,color,excluded,included},i)=>{
      if(i===0||djLightLevel>.015){
        light.includedOnlyMeshes=djMeshes;
        light.excludedMeshes=excluded.filter(mesh=>!djMeshes.includes(mesh));
        light.position.copyFrom(origin);light.diffuse.copyFrom(tint);
        // Controlled absolute intensity avoids clipping from the original high-output room washes.
        light.intensity=(i===0?9:0)+[19,20,14][i]*djLightLevel;
        beam.setEnabled(true);material.alpha=(i===0?.008:0)+.018*djLightLevel;
      }else{
        light.includedOnlyMeshes=included;light.excludedMeshes=excluded;
        light.position.copyFrom(position);beam.setEnabled(false);
      }
    });
    strips.forEach(({ material, base }, i) => {
      B.Color3.Lerp(base,i%2?lookSecondary:lookPrimary,.72).scaleToRef(strobing ? .10 : look.decor*(dancers ? 1 + .14*Math.sin(phase/4+i*2) : 1), material.emissiveColor);
    });
    const viewport=scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight());
    const screenRects=scene.meshes.filter(mesh=>/^EDM (house screen|wing screen (left|right))$/.test(mesh.name)&&mesh.isEnabled()).map(display=>{
      display.computeWorldMatrix(true);const bounds=display.getBoundingInfo().boundingBox;
      return protectedRectangle(bounds.minimumWorld.asArray(),bounds.maximumWorld.asArray(),viewport);
    }).filter(Boolean);
    const djRect=protectedRectangle([edmStage.dj.x-.65,edmStage.dj.y+.55,edmStage.dj.z-.45],[edmStage.dj.x+.65,edmStage.dj.y+2.1,edmStage.dj.z+.45],viewport);
    const hologramRect=stageFocus&&stageEvents.kind!=='laser'?protectedRectangle([-3,2,-6],[9,7,6],viewport):null;
    for(const mesh of scene.meshes){
      const houseBeam=/^(peripheral laser (ray|soft edge)|wall downward light cone|house fan|phrase laser ray)$/.test(mesh.name);
      const fineBeam=/^(peripheral laser (ray|soft edge)|wall downward light cone|house fan|phrase laser ray|Strobe overhead fan beam|Strobe wall curtain beam|overhead shaft|overhead core|scanning fan)$/.test(mesh.name);
      if(!houseBeam&&!fineBeam)continue;
      const showBeam=/^(overhead shaft|overhead core|scanning fan)$/.test(mesh.name);
      const accentBeam=/^Strobe (overhead fan|wall curtain) beam$/.test(mesh.name);
      const base=showBeam||accentBeam?mesh.visibility:houseBeam?look.beams*(performancePriority?.65:1):1;
      if(movingPreview){mesh.visibility=.08;continue;}
      if(effectPreview||accentTest){mesh.visibility=1;continue;}
      let targetGain=1;
      if(fineBeam&&mesh.isEnabled()&&(screenRects.length||hologramRect)){
        const world=mesh.computeWorldMatrix(true);
        const a=B.Vector3.Project(new B.Vector3(0,-.5,0),world,scene.getTransformMatrix(),viewport);
        const b=B.Vector3.Project(new B.Vector3(0,.5,0),world,scene.getTransformMatrix(),viewport);
        if(screenRects.some(rect=>crossesRectangle(a,b,rect))||crossesRectangle(a,b,djRect)||crossesRectangle(a,b,hologramRect))targetGain=.12;
      }
      const previous=beamClearance.get(mesh)??1,gain=previous+(targetGain-previous)*blend;
      beamClearance.set(mesh,gain);mesh.visibility=base*gain;
    }
    scene.materials.filter(m=>['house wash','peripheral thin laser','peripheral laser halo'].includes(m.name))
      .forEach((m,i)=>{if(m.emissiveColor)m.emissiveColor.copyFrom(i%2?lookSecondary:lookPrimary);});
    let detailed = 0,
      ai = 0,
      visibleAI = 0;
    const planes = B.Frustum.GetPlanes(scene.getTransformMatrix());
    const ownSlot = models.get(own)?.actor.trainSlot;
    for (const m of models.values()) {
      const a = m.actor,
        target = new B.Vector3(a.x, a.y, a.z);
      if (a.id !== own || a.seat != null) {
        m.root.position = B.Vector3.Lerp(m.root.position, target, Math.min(1, dt / 90));
        m.root.rotation.y = a.yaw;
      }
      const adjacentRider = ownSlot != null && a.trainSlot != null && Math.abs(a.trainSlot - ownSlot) <= 1;
      const detailRadius = low ? (adjacentRider ? 12 : 8) : 21;
      const close = a.id === own || B.Vector3.DistanceSquared(scene.activeCamera.position, target) < detailRadius ** 2;
      const response = release >= 0 && otherWands && responders.includes(a.id);
      const liftWand = gather > .48 && a.id === wandGuest && a.wand && otherWands && a.trainSlot == null;
      const dance = response ? 'disco-point' : liftWand || a.action === 'dance' ? 'groove' : a.action;
      const showSteps = dance === 'side-step' || dance === 'disco-point';
      const articulated = close || (a.ai && showSteps) || (a.id === wandGuest && otherWands);
      m.near.setEnabled(articulated);
      m.far.setEnabled(!articulated);
      m.showWand(Boolean(a.wand && (a.id === own || otherWands)), articulated);
      if (a.ai) {
        ai++;
        if ((articulated ? m.torso : m.far).isInFrustum(planes)) visibleAI++;
      }
      if (dances.has(dance)) {
        if (articulated) {
          animateDance(m, dance, response ? .85 + release * .6 : beats,
            response ? responders.indexOf(a.id) : a.ai && a.trainSlot == null ? a.danceStyle : undefined, musicEnergy,dynamics.level);
          if (liftWand) {
            const reach = Math.min(1, (gather - .48) * 4);
            const arm = m.limbs[2];
            arm.rotation.z += (2.92 - arm.rotation.z) * reach;
            arm.rotation.x += (-.16 - arm.rotation.x) * reach;
          }
          detailed++;
        } else {
          const sway = Math.sin(phase / 2);
          m.far.position.x = a.action === 'side-step' ? 0.28 * sway : 0;
          m.far.position.y = 0.79 + (a.action === 'groove' ? 0.14 : 0.06) * Math.abs(beatWave);
          m.far.rotation.z = (a.action === 'disco-point' ? 0.24 : 0.1) * sway;
        }
        continue;
      }
      m.near.rotation.setAll(0);
      m.near.position.x = 0;
      m.far.position.x = 0;
      const beat = a.action === 'dance' ? beatWave : Math.sin(t * (a.action === 'walk' ? 8 : 6));
      if (!close) {
        m.far.position.y = a.action === 'sit' ? 0.47 : 0.79;
        m.far.rotation.z = a.action === 'dance' || a.action === 'wave' ? 0.12 * beat : 0;
        continue;
      }
      detailed++;
      m.near.position.y =
        a.action === 'sit' ? -0.32 : a.action === 'dance' ? 0.07 * Math.abs(beat) : 0;
      m.torso.rotation.z = a.action === 'dance' ? 0.18 * beat : 0;
      m.limbs.forEach((j, i) => {
        const sign = i < 2 ? -1 : 1,
          arm = i % 2 === 0;
        j.rotation.x =
          a.action === 'walk'
            ? (arm ? -1 : 1) * sign * 0.55 * beat
            : a.action === 'sit' && !arm
              ? -1.1
              : 0;
        j.rotation.z = arm
          ? a.action === 'wave' && sign > 0
            ? 2.5 + 0.22 * beat
            : a.action === 'dance'
              ? sign * (0.75 + 0.65 * beat)
              : sign * 0.12
          : 0;
      });
    }
    feedback.tick(models,now,calmBeats.matches);
    const segment = playing ? Math.floor(phase32 / 8) : -1;
    animateDance(dj, 'groove', beats, undefined, musicEnergy,dynamics.level);
    animateStaff(dj,'dj',beats,t,musicEnergy,calmBeats.matches);
    animateStaff(bartender,'bartender',beats,t,musicEnergy,calmBeats.matches);
    if ((segment === 1 || segment === 2) && !preview && !celebrating && now >= nextBroadcast) {
      if (segment === 1) {
        broadcastCamera.position.set(edmStage.dj.x,3.20,edmStage.dj.z+3.15);
        broadcastCamera.setTarget(new B.Vector3(edmStage.dj.x,2.83,edmStage.dj.z));
        broadcastCamera.fov = .52;
        broadcast.renderList = dj.near.getChildMeshes();
      } else {
        const guests=[...models.values()].filter(m=>m.actor.trainSlot==null&&m.actor.seat==null&&
          dances.has(m.actor.action)&&Math.hypot(m.actor.x,m.actor.z)<9)
          .sort((a,b)=>Math.hypot(a.actor.x,a.actor.z)-Math.hypot(b.actor.x,b.actor.z)).slice(0,3);
        if (guests.length) {
          const center = guests.reduce((p,m) => p.add(m.root.position), B.Vector3.Zero()).scale(1/guests.length);
          center.y += .95;
          const radius=Math.max(1.2,...guests.map(m=>Math.hypot(m.root.position.x-center.x,m.root.position.z-center.z)));
          const distance=Math.max(4.2,radius*2.1);
          broadcastCamera.position.copyFrom(center).addInPlace(new B.Vector3(distance*.22,1.05,distance));
          broadcastCamera.setTarget(center);
          broadcastCamera.fov = .70;
        }
        broadcast.renderList = guests.flatMap(m => m.near.getChildMeshes());
      }
      broadcast.resetRefreshCounter();
      nextBroadcast = now + 1000/12;
    }
    // Side screens alternate a close DJ shot with graphics; no vacant room broadcasts.
    if(playing&&[0,3].includes(segment)&&!preview&&!celebrating&&now>=nextWingBroadcast){
      const side=segment===0?1:-1;
      wingCamera.position.set(edmStage.dj.x+side*.72,3.18,edmStage.dj.z+3.15);
      wingCamera.setTarget(new B.Vector3(edmStage.dj.x,2.80,edmStage.dj.z));wingCamera.fov=.55;
      wingBroadcast.renderList=dj.near.getChildMeshes();
      wingBroadcast.resetRefreshCounter();nextWingBroadcast=now+1000/10;
    }
    if (own && now - lastSent > 100 && activeSeat === null && !riding) {
      const pos = {
        x: cam.position.x,
        y: cam.position.y - eyeHeight,
        z: cam.position.z,
        yaw: cam.rotation.y,
      };
      const moved =
        !moveBefore || Object.keys(pos).some((k) => Math.abs(pos[k] - moveBefore[k]) > 0.002);
      if (moved || now - lastSent > 950) {
        send('move', pos);
        lastSent = now;
        moveBefore = pos;
      }
    }
    if (now >= nextNameLayout) {
      arrangeNames();
      nextNameLayout = now + 125;
    }
    frames++;
    tally += dt;
    if (tally > 2000) {
      const ms = tally / frames;
      if (mode === 'auto' && ((ms > 28 && !low) || (ms < 16 && low))) quality(!low);
      send('render-info', { ai, detailed, visibleAI, ms, quality: low ? 'low' : 'high' });
      tally = 0;
      frames = 0;
    }
  });
  send('scene-ready', true);
  let lastGateNotice = -Infinity;
  return (from, to) => {
    if(speakerCamera||!connected||gameActive)return false;
    const allowed = permittedPath(from, to, states);
    if (!allowed && performance.now() - lastGateNotice > 4000) {
      send('gate-notice', '아직 열리지 않은 구역입니다. 오른쪽 테이블 구역은 중앙 플로어에서 바로 이동할 수 있습니다.');
      lastGateNotice = performance.now();
    }
    return allowed;
  };
}
