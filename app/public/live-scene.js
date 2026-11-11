import { ceilingLights, musicSpeakers, strobeAccents, strobeAccentCue, accentDurations } from './ceiling-lights.js';
import { clubAmbience, strobeDurations } from './ambience.js';
import { rhythmFloor } from './rhythm-floor.js';
import { playlistPosition, trackBeat, musicDynamics } from './music.js';
import { effects, eventPlayer, ledScreen, houseScreen, houseLights, peripheralTests, peripheralCue } from '/stage/festival/events.js';
import { permittedPath, edmCameraDistance, edmSeats } from './edm-layout.js';
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
  place,
}) {
  const send = (kind, data) => parent.postMessage({ kind, data }, location.origin);
  const models = new Map(),
    make = avatarFactory(B, scene, glow);
  let epoch = Date.now(),
    offset = 0;
  const renderCeiling = ceilingLights(B,scene);
  const renderSpeakers = musicSpeakers(B,scene);
  const renderAccents = strobeAccents(B,scene);
  let accentPreview=null;
  const renderAmbience = clubAmbience(B,scene);
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
  let spectrum = [], spectrumAt = 0;
  const renderFloor = rhythmFloor(B, scene);
  const renderHouseLights = houseLights(B, scene);
  const ambient = scene.getLightByName('ambient');
  if (ambient) ambient.intensity = 0.52;
  let tracks = [], audibleTrack = null;
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
  const updateBoard = houseScreen(B, scene, broadcast);
  let nextBroadcast = 0;

  const cueColors = ['#e587ff', '#54ffe1', '#ff82cb', '#80b8ff'].map(hex => ({
    hex, rgb: B.Color3.FromHexString(hex),
  }));
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
  const boothFace = lightStrip('Booth center fill', 0, 1.91, -11.99, 5.98, .79);
  const boothEnds = [-1, 1].map(side => lightStrip('Booth end glow', side*2.77, 1.91, -11.94, .45, .79));
  const stageLips = [-1, 1].map(side => lightStrip('Stage lip cue', side*4.225, 1.15, -9.985, 4.05, .34));
  function illuminate(mesh, color, level) {
    mesh.setEnabled(level > 0);
    if (level <= 0) return;
    mesh.material.emissiveColor.copyFrom(color);
    mesh.material.alpha = level * (calmBeats.matches ? .4 : .92);
  }
  const stageEvents = eventPlayer(B, scene, () => Date.now() + offset, () => fastFlash);
  const view = playerView(B, scene, cam, canvas, eyeHeight, document.body, { followDistance: 7.1, followLift: 0.47, followFov: 1.23, maxDistance: 24, cameraLimit: edmCameraDistance, arrivalSeconds: 2.5 });
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
  const strips = scene.materials
    .filter((m) => ['Orchid LED', 'Ice LED', 'Rose LED', 'Ultraviolet guide', 'Glacier guide', 'Fuchsia guide', 'LED / chromatic vortex'].includes(m.name))
    .map((material) => ({ material, base: material.emissiveColor.clone() }));
  // The west-side reactive guest already carries a wand beside the entry group.
  const wandGuest = 'ai-3';
  let responders = [];
  function onSnapshot({ actors, self, zones, stageEvent }) {
    if(activePeripheralPreview())stageEvents.stop();else stageEvents.set(stageEvent);
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
      model.actor = a;
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
  let preview, speakerCamera, connected=true;
  function speakerView(kind='speakers'){
    if(speakerCamera)return;
    cancelWalk();
    const positions={speakers:[[-8.5,2.6,11.8],[-18.5,1.8,5.8]],
      bartender:[[-11.3,1.95,14],[-13.6,1.4,17.4]],dj:[[3.9,4.0,-9.2],[0,2.75,-12.9]]};
    const [eye,target]=positions[kind]||positions.speakers;
    speakerCamera=new B.FreeCamera('Club observation',B.Vector3.FromArray(eye),scene);
    speakerCamera.setTarget(B.Vector3.FromArray(target));
    view.preview(speakerCamera);
    const close=document.createElement('button');
    close.textContent=kind==='speakers'?'스피커 보기 종료':'직원 보기 종료';
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
      epoch = data.epoch;
      tracks = data.tracks || [];
      offset = data.offset;
    }
    if (kind === 'audible-track') audibleTrack = data;
    if (kind === 'speaker-view') speakerView();
    if (kind === 'staff-view' && ['dj','bartender'].includes(data)) speakerView(data);
    if(kind==='accent-preview'&&Object.hasOwn(accentDurations,data)){
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
    if (kind === 'connection-state') {
      connected=data===true;
      if(!connected){cancelWalk();joystick(0,0);stageEvents.stop();}
    }
    if (kind === 'place') {
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
  let seatTap = null;
  canvas.addEventListener('pointerdown', e=>{
    seatTap=e.button===0?{id:e.pointerId,x:e.clientX,y:e.clientY,drag:false}:null;
  });
  canvas.addEventListener('pointermove', e=>{
    if(seatTap?.id===e.pointerId&&Math.hypot(e.clientX-seatTap.x,e.clientY-seatTap.y)>6)seatTap.drag=true;
  });
  canvas.addEventListener('pointercancel', ()=>seatTap=null);
  canvas.addEventListener('pointerup', e=>{
    const tap=seatTap;seatTap=null;
    if(!tap||tap.id!==e.pointerId||tap.drag||activeSeat!==null||riding||speakerCamera||preview||!connected)return;
    const bounds=canvas.getBoundingClientRect();
    const hit=pickDestination((e.clientX-bounds.left)*engine.getRenderWidth()/bounds.width,
      (e.clientY-bounds.top)*engine.getRenderHeight()/bounds.height);
    if(!hit?.hit)return;
    const point=hit.pickedPoint,names=[hit.pickedMesh.name,hit.pickedMesh.parent?.name];
    const booth=names.some(name=>/^Wall booth (seat|table|back|base)$/.test(name));
    let selected=-1;
    if(booth){
      let distance=Infinity;
      edmSeats.forEach((seat,index)=>{
        if(!seat.table)return;
        const d=Math.hypot(seat.x-point.x,seat.z-point.z);
        if(d<distance){distance=d;selected=index;}
      });
      if([...models.values()].some(m=>m.actor.seat===selected)){
        send('gate-notice','이미 앉아 있는 자리입니다. 다른 의자를 선택해 주세요.');return;
      }
    }else if(!['Arena floor','Entry floor','Dance floor','DJ platform','DJ access','West dance zone','West deck ramp','West upper deck'].some(name=>names.includes(name)))return;
    const goal=selected>=0?edmSeats[selected].exit:point;
    const arrived=selected<0?null:()=>{
      send('move',{x:cam.position.x,y:cam.position.y-eyeHeight,z:cam.position.z,yaw:cam.rotation.y});
      send('seat-request',selected);
    };
    if(!navigate(goal,arrived,(from,to)=>permittedPath(from,to,states)))
      send('gate-notice','걸어갈 수 있는 경로가 없습니다. 가까운 열린 바닥을 선택해 주세요.');

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
    const beats = trackBeat(playback, t);
    const effectPreview=activePeripheralPreview();
    const playing = playback && playback.track.id === audibleTrack;
    const dynamics=musicDynamics(playback);
    const peripheralPlan=peripheralCue(beats,playback?.track.bpm||120,effectPreview,Boolean(playing),dynamics.level);
    const celebrating = stageEvents.kind === 'led';
    const strobing = stageEvents.strobing;
    const audioBands = performance.now()-spectrumAt<350 && audibleTrack ? spectrum : [];
    const musicEnergy = Math.min(1,((audioBands[0]||0)+(audioBands[1]||0)+(audioBands[2]||0))/3);
    const previewAge = (performance.now()-strobePreviewStarted)/1000;
    // After either test, leave a normal-light gap before automatic accents resume.
    const smokeProtection=peripheralPlan.protectSmoke&&previewAge>=strobeDurations[strobePreviewPattern];
    const effectBlocksStrobe=Boolean(accentPreview)||(effectPreview&&effectPreview.kind!=='strobe-hold');
    const roomPulse = renderAmbience(beats, audioBands, strobing||Boolean(effectBlocksStrobe)||Boolean(smokeProtection), Boolean(audibleTrack), playback?.track.bpm || 120, previewAge<strobeDurations[strobePreviewPattern]+1.6 ? previewAge : null, strobePreviewPattern,dynamics.level);
    renderCeiling(beats,strobing,musicEnergy,roomPulse);
    renderSpeakers(beats,audioBands,Boolean(playing),dt,calmBeats.matches);
    const accentAge=accentPreview?(performance.now()-accentPreview.start)/1000:0;
    if(accentPreview&&accentAge>=accentDurations[accentPreview.kind])accentPreview=null;
    const accentTest=accentPreview?{kind:accentPreview.kind,age:accentAge}:null;
    const accentCue=strobeAccentCue({beat:beats,bpm:playback?.track.bpm||120,playing:Boolean(playing),
      preview:accentTest,strobePreview:previewAge<strobeDurations[strobePreviewPattern]?{kind:strobePreviewPattern,age:previewAge}:null,
      overlap:stageEvents.kind&&stageEvents.kind!=='led'||peripheralPlan.laser>.5,
      protectSmoke:Boolean(smokeProtection),reduced:calmBeats.matches,arrangement:dynamics.level});
    renderAccents(accentCue,beats,accentTest?.75:musicEnergy,calmBeats.matches,dt);
    if (ambient) ambient.intensity = (smokeProtection?.42:.52) + roomPulse * 1.65;
    // The first beat of each four-beat bar accents both surfaces on the same frame.
    const barPhase = ((beats % 4) + 4) % 4;
    const accent = playing && beats >= 0 ? Math.max(0, 1 - barPhase / .78) * (calmBeats.matches ? .3 : 1) : 0;
    // Every visual phrase restarts with the selected song at its loop boundary.
    const phraseBeat = playing ? (playback.phraseTime - (playback.track.firstBeat || 0)) * (playback.track.bpm || 120) / 60 : -1;
    const phase32 = phraseBeat % 32;
    const gather = phase32 >= 30 ? (phase32 - 30) / 2 : 0;
    const release = phraseBeat >= 32 && phase32 < 3 ? phase32 / 3 : -1;
    renderHouseLights(beats, !stageEvents.kind, preview||accentPreview ? -1 : release, playback?.track.bpm || 120, musicEnergy, strobing, effectPreview, Boolean(playing),dynamics.level);
    // Pick the upcoming phrase's color during the pickup and keep it through the release.
    const cue = cueColors[Math.floor((Math.max(0, phraseBeat) + 2) / 32) % cueColors.length];
    const wallRelease = preview || celebrating ? -1 : release;
    // Times are measured in beats after the wall opens. Let neighboring surfaces overlap.
    const cueBeat = playing && phraseBeat >= 32 && !preview && !celebrating ? phase32 : -1;
    const ramp = (value, span) => Math.max(0, Math.min(1, value / span));
    boothFace.scaling.x = Math.max(.001, ramp(cueBeat - .10, .90));
    illuminate(boothFace, cue.rgb, ramp(cueBeat - .10, .18) * ramp(1.85 - cueBeat, .8));
    const endGlow = ramp(cueBeat - .86, .16) * ramp(4.2 - cueBeat, .75);
    for (const end of boothEnds) illuminate(end, cue.rgb, endGlow);
    const lipGlow = ramp(cueBeat - 1.22, .28) * ramp(2.95 - cueBeat, .75);
    for (const lip of stageLips) illuminate(lip, cue.rgb, lipGlow);
    renderFloor(beats, celebrating, accent, cueBeat, cue.rgb, stageEvents.kind === 'laser' ? 1 : ['phoenix','whale','dragon','jellyfish','butterflies'].includes(stageEvents.kind) ? 2 : 0, roomPulse);
    updateBoard(playing ? playback.track.title : null, beats, !preview && !celebrating, accent, gather, calmBeats.matches, phraseBeat, wallRelease, cue.hex, stageEvents.kind && stageEvents.kind !== 'led' ? effects[stageEvents.kind].label : null, strobing, roomPulse);
    const phase = beats * Math.PI * 2,
      beatWave = Math.sin(phase);
    washes.forEach(({ light, base }, i) => {
      light.intensity = base * (strobing ? .20 : 1+roomPulse*1.5) * (dancers ? 1 + 0.38 * Math.sin(phase / 4 + (i * Math.PI) / 2) : 1);
    });
    strips.forEach(({ material, base }, i) => {
      base.scaleToRef(strobing ? .16 : dancers ? 1 + 0.26 * Math.sin(phase / 4 + i * 2) : 1, material.emissiveColor);
    });
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
            response ? responders.indexOf(a.id) : a.ai && a.trainSlot == null ? a.danceStyle : undefined, musicEnergy);
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
    const segment = playing ? Math.floor(phase32 / 8) : -1;
    animateDance(dj, 'groove', beats, undefined, musicEnergy);
    animateStaff(dj,'dj',beats,t,musicEnergy,calmBeats.matches);
    animateStaff(bartender,'bartender',beats,t,musicEnergy,calmBeats.matches);
    if ((segment === 1 || segment === 2) && !preview && !celebrating && now >= nextBroadcast) {
      if (segment === 1) {
        broadcastCamera.position.set(0, 3.16, -11.60);
        broadcastCamera.setTarget(new B.Vector3(0, 3.08, -13.35));
        broadcastCamera.fov = .43;
        broadcast.renderList = dj.near.getChildMeshes();
      } else {
        const caller = models.get(wandGuest);
        const guests = [caller, ...responders.map(id => models.get(id))].filter(m => m && m.actor.trainSlot == null);
        if (guests.length) {
          const center = guests.reduce((p,m) => p.add(m.root.position), B.Vector3.Zero()).scale(1/guests.length);
          center.y += .95;
          broadcastCamera.position.copyFrom(center).addInPlace(new B.Vector3(11, 1.4, 3.7));
          broadcastCamera.setTarget(center);
          broadcastCamera.fov = .65;
        }
        broadcast.renderList = guests.flatMap(m => m.near.getChildMeshes());
      }
      broadcast.resetRefreshCounter();
      nextBroadcast = now + 1000/12;
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
    if(speakerCamera||!connected)return false;
    const allowed = permittedPath(from, to, states);
    if (!allowed && performance.now() - lastGateNotice > 4000) {
      send('gate-notice', '아직 열리지 않은 구역입니다. 오른쪽 테이블 구역은 중앙 플로어에서 바로 이동할 수 있습니다.');
      lastGateNotice = performance.now();
    }
    return allowed;
  };
}
