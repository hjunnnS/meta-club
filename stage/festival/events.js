import { celebration } from './celebration.js';
import { hologram } from './holograms.js';
// Channel performances and local previews share the same durations.
export const effects = {
  led: { label: 'LED 전광판', seconds: 15 },
  laser: { label: '레이저 쇼', seconds: 16 },
  fountain: { label: '분수 불꽃 시험', seconds: 5 },
  confetti: { label: '종이조각 시험', seconds: 7 },
  phoenix: { label: '불사조', seconds: 14 },
  whale: { label: '대형 고래', seconds: 14 },
  dragon: { label: '네온 용', seconds: 14 },
  jellyfish: { label: '우주 해파리', seconds: 14 },
  butterflies: { label: '나비 군집', seconds: 14 },
};

function lettering(message, nickname) {
  const layer = document.createElement('canvas');
  layer.width = 1024;
  layer.height = 384;
  const ctx = layer.getContext('2d');
  ctx.shadowColor = '#050622';
  ctx.shadowBlur = 8;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#10142c';
  ctx.lineWidth = 8;
  ctx.textAlign = 'center';
  ctx.font = Array.from(message).length <= 14 ? 'bold 86px sans-serif' : 'bold 48px sans-serif';
  const lines = [''];
  for (const character of message) {
    if (ctx.measureText(lines.at(-1) + character).width > 930) lines.push(character);
    else lines[lines.length - 1] += character;
  }
  const spacing = Math.min(80, 235 / lines.length);
  ctx.fillStyle = '#ffdef5';
  lines.forEach((line, i) => {
    const y = (nickname ? 170 : 210) + (i - (lines.length - 1) / 2) * spacing;
    ctx.strokeText(line, 512, y);
    ctx.fillText(line, 512, y);
  });
  if (nickname) {
    ctx.font = 'bold 35px sans-serif';
    ctx.fillStyle = '#80f1ee';
    ctx.strokeText(nickname, 512, 331, 930);
    ctx.fillText(nickname, 512, 331, 930);
  }
  return layer;
}

// Original moving artwork. Keep the lettering on a separate layer above the media wall.
function mediaWall(ctx, t) {
  const wash = ctx.createLinearGradient(0, 0, 1024, 384);
  wash.addColorStop(0, '#122b68');
  wash.addColorStop(0.53, '#090f30');
  wash.addColorStop(1, '#174858');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1024, 384);
  for (let ribbon = 0; ribbon < 16; ribbon++) {
    ctx.beginPath();
    for (let x = -16; x <= 1040; x += 16) {
      const y = 175 + ribbon * 5 + 78 * Math.sin(x / 181 - t * 0.94 + ribbon * 0.12)
        + 44 * Math.sin(x / 89 + t * 0.51 + ribbon * 0.07);
      if (x === -16) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = ribbon % 4 === 0 ? 3.4 : 1.5;
    ctx.strokeStyle = ribbon < 8 ? '#467ddb' : '#419daa';
    ctx.stroke();
  }
  for (let i = 0; i < 68; i++) {
    const x = (i * 103 + t * (12 + i % 5 * 9)) % 1170 - 92;
    const y = (i * 71 + t * (7 + i % 4)) % 520 - 108;
    const width = 12 + i * 17 % 73, height = 20 + i * 23 % 102;
    ctx.strokeStyle = ['#226097', '#24aab2', '#68e1d0', '#669df5'][i % 4];
    ctx.lineWidth = i % 6 === 0 ? 3 : 1.4;
    ctx.strokeRect(x, y, width, height);
  }
}

export function ledScreen(B, scene, message, nickname = '', overlay = lettering(message, nickname)) {
  const texture = new B.DynamicTexture('stage message', { width: 1024, height: 384 }, scene, false);
  const ctx = texture.getContext();
  mediaWall(ctx, 0);
  ctx.drawImage(overlay, 0, 0);
  texture.update();
  const material = new B.StandardMaterial('LED message', scene);
  material.emissiveTexture = texture;
  material.disableLighting = true;
  material.backFaceCulling = false;
  const screen = B.MeshBuilder.CreatePlane('LED message', { width: 12.8, height: 5.3 }, scene);
  screen.position.set(0, 5.5, -17.90);
  screen.material = material;
  screen.isPickable = false;
  return screen;
}

// Four eight-beat looks on the same 32-beat clock as the floor and crowd.
function playWall(ctx, beat) {
  const section = Math.floor(beat / 8) % 4;
  const baseHue = [258, 181, 316, 225][section];
  const hue = baseHue + 28 * Math.sin(beat * Math.PI / 4);
  const kick = Math.exp(-3.4 * (beat % 1));
  const wash = ctx.createLinearGradient(0, 0, 1024, 384);
  wash.addColorStop(0, `hsl(${hue} 90% 41%)`);
  wash.addColorStop(.5, `hsl(${hue+18} 74% 13%)`);
  wash.addColorStop(1, `hsl(${hue+85} 92% 40%)`);
  ctx.fillStyle = wash;
  ctx.fillRect(0,0,1024,384);
  ctx.save();
  ctx.translate(512,192);
  for (let i=0; i<9; i++) {
    const travel = ((beat * .32 + i) % 9) / 9;
    ctx.strokeStyle = `hsla(${hue+travel*125} 100% 68% / ${.28+.65*travel})`;
    ctx.lineWidth = 3 + 15*travel + 4*kick;
    ctx.beginPath();
    if (section % 2 === 0) {
      ctx.ellipse(0, 0, 24+650*travel, 10+295*travel, .19*Math.sin(beat*.8), 0, Math.PI*2);
    } else {
      for (let x=-540; x<=540; x+=12) {
        const y = (travel-.5)*510 + 67*Math.sin(x*.011 + beat*.9 + travel*5);
        if (x===-540) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
  // Keep a dark field behind the title while the outer wall remains saturated.
  const shade = ctx.createRadialGradient(512,165,25,512,165,440);
  shade.addColorStop(0,'rgba(10,4,32,.70)');
  shade.addColorStop(1,'rgba(10,4,32,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0,0,1024,384);
}

export function houseScreen(B, scene, broadcast) {
  let title, overlay, lastFrame = -1;
  const screen = ledScreen(B, scene, 'EDM CLUB');
  screen.name = 'EDM house screen';
  screen.scaling.set(1.42, 1.21, 1);
  screen.position.set(3.2, 5.85, -13.95);
  const flashInk=paint(B,scene,'screen synchronized flash','#fff3df');
  flashInk.disableLighting=true;flashInk.backFaceCulling=false;
  const flashPanel=B.MeshBuilder.CreatePlane('screen flash accent',{width:12.8,height:5.3},scene);
  flashPanel.parent=screen;flashPanel.position.z=.025;flashPanel.material=flashInk;flashPanel.isPickable=false;
  flashPanel.setEnabled(false);
  const texture = screen.material.emissiveTexture;
  const ctx = texture.getContext();
  if (broadcast) {
    const material = new B.ShaderMaterial('EDM program screen', scene, {
      vertexSource: 'precision highp float; attribute vec3 position; attribute vec2 uv; uniform mat4 worldViewProjection; varying vec2 vUV; void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.);}',
      fragmentSource: `precision highp float; varying vec2 vUV; uniform sampler2D artwork; uniform sampler2D feed; uniform float live;
        void main(){vec4 bg=texture2D(artwork,vUV);vec4 video=texture2D(feed,vUV);
        float edge=smoothstep(.08,.18,vUV.x)*(1.-smoothstep(.82,.92,vUV.x));
        gl_FragColor=vec4(mix(bg.rgb,video.rgb,live*edge*video.a),1.);}`
    }, {attributes:['position','uv'],uniforms:['worldViewProjection','live'],samplers:['artwork','feed']});
    material.setTexture('artwork', texture);
    material.setTexture('feed', broadcast);
    material.backFaceCulling = false;
    screen.material.dispose();
    screen.material = material;
  }
  let lastSegment = -1, lastPerformance, lastDim;
  return (track, beats, visible, accent, gather, calm, phraseBeat, release, cueColor, performanceTitle = null, dimBackground = false, roomPulse = 0) => {
    flashInk.alpha=calm?0:roomPulse*.58;
    flashPanel.setEnabled(visible&&!calm&&roomPulse>.001);
    screen.setEnabled(visible);
    if (!visible) return;
    const segment = track && !performanceTitle ? Math.floor(Math.max(0, phraseBeat) % 32 / 8) : -1;
    if (broadcast) screen.material.setFloat('live', segment === 1 || segment === 2 ? 1 : 0);
    const frame = Math.floor(beats * 12);
    if (title !== track || lastSegment !== segment || lastPerformance !== performanceTitle || lastDim !== dimBackground) {
      title = track;
      lastSegment = segment;
      lastPerformance = performanceTitle;
      lastDim = dimBackground;
      overlay = performanceTitle ? lettering(performanceTitle) : segment === 1 || segment === 2 ? null : track ? lettering(track, 'EDM CLUB') : lettering('EDM CLUB');
    } else if (lastFrame === frame) return;
    lastFrame = frame;
    if (track) playWall(ctx, calm ? 0 : Math.max(0, phraseBeat));
    else mediaWall(ctx, beats * 0.36);
    // Mirrored neon wings leave the dark central field clear for the title.
    const sweep = calm ? 0 : Math.sin(beats * Math.PI / 4);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side < 0 ? 0 : 1024, 0);
      ctx.scale(-side, 1);
      for (let i = 0; i < 5; i++) {
        const x = 10 + i * 24;
        const tip = x + 65 + 12 * sweep + gather * (370 - i * 12);
        ctx.beginPath();
        ctx.moveTo(x - 36, 0);
        ctx.lineTo(tip, 192);
        ctx.lineTo(x - 36, 384);
        ctx.strokeStyle = ['#7555e0','#389fce','#30d6d3','#f558bd','#ffc07a'][i];
        ctx.lineWidth = i === 4 ? 12 : 5;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (accent > 0) {
      ctx.fillStyle = `rgba(71, 206, 228, ${.28 * accent})`;
      ctx.fillRect(0, 0, 1024, 384);
      ctx.fillStyle = `rgba(159, 255, 245, ${accent})`;
      ctx.fillRect(0, 14, 1024, 18);
      ctx.fillRect(0, 352, 1024, 18);
    }
    if (release >= 0 && release < .60) {
      const progress = release / .60;
      const radius = calm ? 185 : 34 + 890 * (1 - (1 - progress) ** 2);
      ctx.save();
      ctx.translate(512, 192);
      ctx.scale(1, .62);
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius, 0);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle = cueColor;
      ctx.globalAlpha = (1 - progress) * (calm ? .14 : .40);
      ctx.fill();
      ctx.globalAlpha = (1 - progress) * .95;
      ctx.lineWidth = 28;
      ctx.stroke();
      ctx.restore();
    }
    if (dimBackground) {
      ctx.fillStyle = 'rgba(0,0,0,.80)';
      ctx.fillRect(0,0,1024,384);
    }
    const contraction = release >= 0 ? Math.min(1, (1 - release) / .55) : gather;
    const scale = 1 - (calm ? .18 : .56) * contraction;
    if (overlay) ctx.drawImage(overlay, 512*(1-scale), 192*(1-scale), 1024*scale, 384*scale);
    texture.update();
  };
}

function paint(B, scene, name, hex, intensity = 0.7) {
  const material = new B.StandardMaterial(name, scene);
  material.diffuseColor = B.Color3.FromHexString(hex);
  material.emissiveColor = material.diffuseColor.scale(intensity);
  material.backFaceCulling = false;
  return material;
}

function attach(mesh, parent, material) {
  mesh.parent = parent;
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

function marquee(B, scene, root, event, fastFlash) {
  const overlay = lettering(event.message, event.nickname);
  const screen = ledScreen(B, scene, event.message, event.nickname, overlay);
  screen.parent = root;
  const texture = screen.material.emissiveTexture;
  const ctx = texture.getContext();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastFrame = -1;
  return t => {
    const frame = Math.floor(Math.round(t * 1000) / 50);
    if (frame === lastFrame) return;
    lastFrame = frame;
    mediaWall(ctx, t);
    const sweep = (t % 3.5) / 2.6 * 1360 - 170;
    const shine = ctx.createLinearGradient(sweep - 75, 0, sweep + 75, 45);
    shine.addColorStop(0, 'transparent');
    shine.addColorStop(0.5, 'rgba(197,245,255,0.30)');
    shine.addColorStop(1, 'transparent');
    ctx.fillStyle = shine;
    ctx.fillRect(21, 19, 982, 346);
    for (let i = 0; i < 29; i++) {
      const wave = (1 + Math.cos(i * 0.5 - t * 4)) / 2;
      ctx.fillStyle = 'rgba(255,218,158,' + (0.18 + 0.8 * wave ** 3) + ')';
      const x = 30 + i * 34.4;
      ctx.fillRect(x, 24, 15, 7);
      ctx.fillRect(1009 - x, 353, 15, 7);
    }
    // A small four-point glint travels along each edge without obscuring the lettering.
    for (const [x, y] of [[sweep, 29], [1024 - sweep, 356]]) {
      if (x < 23 || x > 1001) continue;
      ctx.fillStyle = '#fff3d5';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r = i % 2 ? 3 : 16;
        ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fill();
    }
    // 20 Hz gives each 100 ms shutter state two texture frames.
    const cycle = frame % 100;
    const blinking = (cycle >= 20 && cycle < 40) || cycle >= 80;
    const offFrames = fastFlash() ? 2 : 5;
    if (reducedMotion.matches || !blinking || Math.floor(cycle / offFrames) % 2 === 1)
      ctx.drawImage(overlay, 0, 0);
    texture.update();
  };
}

function laserBlackouts(start) {
  // The show start seeds one shared sequence, including for spectators who join mid-show.
  let seed = start >>> 0;
  function between(min, max) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return min + (max - min) * seed / 4294967296;
  }
  const cuts = [];
  let at = between(0.55, 1.25);
  while (at < effects.laser.seconds) {
    const end = at + between(0.13, 0.34);
    cuts.push([at, end]);
    if (between(0, 1) < 0.45) {
      const second = end + between(0.29, 0.54);
      at = second + between(0.13, 0.22);
      cuts.push([second, at]);
    } else {
      at = end;
    }
    at += between(0.62, 1.8);
  }
  return cuts;
}

export const strobeDurations={normal:5,transition:7};
export function strobeSchedule(beat,bpm=120) {
  const period=32*60/Math.max(1,bpm),cycle=Math.floor(beat/32);
  const seconds=(((beat%32)+32)%32)*60/Math.max(1,bpm);
  const normalAt=Math.max(period/2,strobeDurations.transition+.2);
  const smokeAt=normalAt+strobeDurations.normal+.25;
  let smokeTime=seconds-smokeAt;
  if(smokeTime<0)smokeTime=cycle>0?smokeTime+period:-1;
  return {kind:seconds<normalAt?'transition':'normal',elapsed:beat<0?-1:seconds<normalAt?seconds:seconds-normalAt,smokeTime:beat<0?-1:smokeTime};
}
export const peripheralTests = {smoke:6, laser:4, wash:4};
export function peripheralCue(beat,bpm=120,preview=null,playing=true,arrangement=1) {
  const fade=(t,a,b)=>{const p=Math.max(0,Math.min(1,(t-a)/(b-a)));return p*p*(3-2*p);};
  if(preview) {
    const {kind,age}=preview,seconds=peripheralTests[kind];
    const active=Number.isFinite(age)&&age>=0&&age<seconds;
    const level=active?fade(age,0,.25)*(1-fade(age,seconds-.6,seconds)):0;
    return {smokeTime:age,smoke:active&&kind==='smoke',laser:kind==='laser'?level:0,wash:kind==='wash'?level:0,preview:true,protectSmoke:active&&kind==='smoke'};
  }
  if(!playing||beat<0)return {smokeTime:0,smoke:false,laser:0,wash:0,preview:false};
  const phase=((beat%32)+32)%32;
  const {smokeTime}=strobeSchedule(beat,bpm);
  if(arrangement<.55)return {smokeTime:0,smoke:false,laser:0,wash:.16+.10*(.5+.5*Math.sin(beat*Math.PI/8)),preview:false,protectSmoke:false};
  const strong=arrangement>=.82;
  return {smokeTime,smoke:strong&&smokeTime>=0&&smokeTime<5.5,
    laser:fade(phase,9,11)*(1-fade(phase,20,24))*(strong?1:.40),
    wash:(.15+.85*fade(phase,18,22)*(1-fade(phase,28,32)))*(strong?1:.65),preview:false,
    protectSmoke:strong&&smokeTime>=-.15&&smokeTime<2.0};
}

// Peripheral atmosphere remains visible independently of the central stage show.
function peripheralLighting(B,scene) {
  const calm=matchMedia('(prefers-reduced-motion: reduce)');
  const rig=new B.TransformNode('entry and wall lighting',scene);
  const stations=[[-6,7.0,19.2],[6,7.0,19.2],[-15.8,7.4,-2],[15.8,7.4,-2],[-14.8,7.4,8],[14.8,7.4,8],[-16.7,7.4,16],[16.7,7.4,16]];
  const housing=paint(B,scene,'peripheral fixture graphite','#252235');
  const lens=paint(B,scene,'peripheral fixture lens','#fff0d5');lens.disableLighting=true;
  const texture=new B.DynamicTexture('peripheral soft falloff',64,scene,false);
  const ctx=texture.getContext(),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.35,'#b8b8b8');gradient.addColorStop(1,'#000000');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);texture.getAlphaFromRGB=true;texture.update();
  const lamps=stations.map(([x,y,z],i)=>{
    const origin=new B.Vector3(x,y,z);
    const body=attach(B.MeshBuilder.CreateCylinder('wall downlight housing',{height:.42,diameter:.48,tessellation:10},scene),rig,housing);
    body.position.copyFrom(origin);body.position.y+=.18;
    const cable=attach(B.MeshBuilder.CreateCylinder('downlight suspension',{height:10.9-y,diameter:.025,tessellation:4},scene),rig,housing);
    cable.position.set(x,(10.9+y)/2,z);
    const glass=attach(B.MeshBuilder.CreateSphere('wall downlight lens',{diameter:.25,segments:6},scene),rig,lens);
    glass.position.copyFrom(origin);
    const ink=paint(B,scene,'peripheral broad beam',i%2?'#d8d3ff':'#fff0d5');
    ink.disableLighting=true;ink.alphaMode=B.Engine.ALPHA_ADD;ink.alpha=.085;
    const cone=attach(B.MeshBuilder.CreateCylinder('wall downward light cone',{height:1,diameterBottom:.14,diameterTop:4.3,tessellation:16,cap:B.Mesh.NO_CAP},scene),rig,ink);
    cone.rotationQuaternion=new B.Quaternion();
    const poolInk=paint(B,scene,'peripheral floor glow','#fff0dc');
    poolInk.disableLighting=true;poolInk.opacityTexture=texture;poolInk.alphaMode=B.Engine.ALPHA_ADD;poolInk.alpha=.16;
    const pool=attach(B.MeshBuilder.CreateGround('wall downlight floor pool',{width:4.3,height:4.3},scene),rig,poolInk);
    const rayInk=paint(B,scene,'peripheral thin laser',i%2?'#ffce4c':'#67ff83',1);
    rayInk.disableLighting=true;rayInk.alphaMode=B.Engine.ALPHA_ADD;
    const haloInk=paint(B,scene,'peripheral laser halo',i%2?'#ffce4c':'#67ff83',1);
    haloInk.disableLighting=true;haloInk.alphaMode=B.Engine.ALPHA_ADD;
    const rays=[-1,1].map(spread=>{
      const ray=attach(B.MeshBuilder.CreateCylinder('peripheral laser ray',{height:1,diameter:.06,tessellation:6,cap:B.Mesh.NO_CAP},scene),rig,rayInk);
      const halo=attach(B.MeshBuilder.CreateCylinder('peripheral laser soft edge',{height:1,diameter:.15,tessellation:6,cap:B.Mesh.NO_CAP},scene),rig,haloInk);
      ray.rotationQuaternion=new B.Quaternion();halo.rotationQuaternion=new B.Quaternion();return {ray,halo,spread};
    });
    return {origin,body,glass,cone,pool,ink,poolInk,rays,rayInk,haloInk};
  });
  // Only two real spotlights are active: one on each side, near the current view.
  const realWashes=[-1,1].map(side=>{
    const light=new B.SpotLight('peripheral real wash '+side,B.Vector3.Zero(),new B.Vector3(0,-1,0),.75,2,scene);
    light.diffuse=B.Color3.FromHexString(side<0?'#fff0d5':'#e0dfff');light.range=14;light.intensity=0;light.renderPriority=50;
    return {side,light};
  });
  const ambient=scene.getLightByName('ambient');if(ambient)ambient.renderPriority=100;
  const smokeStations=Array.from({length:8},(_,i)=>{
    const angle=i*Math.PI/4+Math.PI/8;
    const position=[8.85*Math.cos(angle),.09,8.85*Math.sin(angle)];
    const nozzle=attach(B.MeshBuilder.CreateCylinder('arena smoke nozzle',{height:.12,diameter:.17,tessellation:8},scene),rig,housing);
    nozzle.position.set(position[0],.06,position[2]);return position;
  });
  const smokeInk=paint(B,scene,'arena upward smoke','#d5d8df',.4);
  smokeInk.disableLighting=true;smokeInk.opacityTexture=texture;smokeInk.alpha=.18;smokeInk.backFaceCulling=false;
  const smoke=new B.SolidParticleSystem('arena upward smoke jets',scene);
  smoke.computeBoundingBox=true;
  const puff=B.MeshBuilder.CreatePlane('peripheral haze template',{size:1},scene);
  smoke.addShape(puff,smokeStations.length*32);puff.dispose();
  const cloud=smoke.buildMesh();cloud.parent=rig;cloud.material=smokeInk;cloud.isPickable=false;cloud.hasVertexAlpha=true;smoke.billboard=true;
  for(const layer of scene.effectLayers||[])if(typeof layer.addExcludedMesh==='function')layer.addExcludedMesh(cloud);
  let time=0;
  const noise=(i,s)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  smoke.updateParticle=p=>{
    const station=Math.floor(p.idx/32),[x,y,z]=smokeStations[station];
    // A strong upward jet slows near the rig and leaves a fading cloud above the rim.
    const age=time-station*.035-noise(p.idx,1)*.95;
    p.isVisible=age>=0&&age<4.2;if(!p.isVisible)return p;
    const rise=Math.min(age,1.5)*4.2+Math.max(0,age-1.5)*.35;
    p.position.set(x+(noise(p.idx,2)-.5)*(.25+age*.25),y+rise,z+(noise(p.idx,3)-.5)*(.25+age*.25));
    const jet=age<.7;
    p.scaling.set(jet?.40+age*.4:.68+age*.60,jet?1.9:1.2+age*.3,1);
    p.rotation.z=(noise(p.idx,4)-.5)*.30;
    p.color ||= new B.Color4(1,1,1,1);p.color.a=Math.min(1,age*3)*Math.pow(Math.max(0,1-age/4.2),.75);
    return p;
  };
  const target=new B.Vector3(),direction=new B.Vector3();
  return (beat,bpm,energy,strobing,cue)=>{
    time=cue.smokeTime;
    cloud.setEnabled(!calm.matches&&cue.smoke);if(cloud.isEnabled())smoke.setParticles();
    const selected=new Map(realWashes.map(({side,light})=>{
      const candidates=lamps.filter(lamp=>Math.sign(lamp.origin.x)===side);
      const z=scene.activeCamera?.position.z||0;
      const lamp=candidates.reduce((a,b)=>Math.abs(a.origin.z-z)<Math.abs(b.origin.z-z)?a:b);
      light.intensity=0;return [lamp,light];
    }));
    lamps.forEach((lamp,i)=>{
      const {origin,cone,pool,ink,poolInk,body,rays,rayInk,haloInk}=lamp;
      const phase=calm.matches?0:beat*.10+i*.8;
      const inward=origin.x>0?-1:1;
      target.set(origin.x+inward*(1.15+.45*Math.sin(phase)),.075,origin.z+.8*Math.sin(phase*.7));
      target.subtractToRef(origin,direction);
      cone.position.copyFrom(origin).addInPlace(direction.scale(.5));cone.scaling.y=direction.length();
      B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,direction.normalize(),cone.rotationQuaternion);
      body.rotationQuaternion=cone.rotationQuaternion;
      pool.position.copyFrom(target);
      const strength=strobing?.10:1+.35*energy;
      const real=selected.get(lamp);
      if(real){real.position.copyFrom(origin);real.direction.copyFrom(direction);real.intensity=40*cue.wash*strength;}
      cone.setEnabled(cue.wash>.001);pool.setEnabled(cue.wash>.001);
      ink.alpha=.085*strength*cue.wash;poolInk.alpha=.18*strength*cue.wash;
      rayInk.alpha=cue.laser*strength*(.65+.35*energy);
      haloInk.alpha=rayInk.alpha*.13;
      for(const {ray,halo,spread} of rays) {
        ray.setEnabled(cue.laser>.001);halo.setEnabled(cue.laser>.001);if(!ray.isEnabled())continue;
        const fan=calm.matches?3:1.5+5*(.5-.5*Math.cos(beat*Math.PI/2));
        target.set(origin.x*.35+spread*fan,1.1+1.8*(.5+.5*Math.sin(phase*.8+spread)),origin.z-4+7*Math.sin(phase*.65+spread));
        target.subtractToRef(origin,direction);ray.position.copyFrom(origin).addInPlace(direction.scale(.5));ray.scaling.y=direction.length();
        B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,direction.normalize(),ray.rotationQuaternion);
        halo.position.copyFrom(ray.position);halo.scaling.copyFrom(ray.scaling);halo.rotationQuaternion.copyFrom(ray.rotationQuaternion);
        if(cue.laser>cue.wash&&spread===-1)body.rotationQuaternion=ray.rotationQuaternion;
      }
    });
  };
}

// House lights sweep continuously between events, including when the room has just opened.
export function houseLights(B, scene) {
  const renderPeriphery=peripheralLighting(B,scene);
  const rig = new B.TransformNode('house lighting rig', scene);
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#489eff', '#ff36a8'];
  const lights = colors.map(hex => {
    const material = paint(B, scene, 'house wash', hex, 0.58);
    material.disableLighting = true;
    material.alphaMode = B.Engine.ALPHA_ADD;
    material.alpha = 0.065;
    return material;
  });
  const beams = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const origin = new B.Vector3(side * (3.4 + 1.35 * i), 6.7, -12 + i * .6);
      const mesh = attach(B.MeshBuilder.CreateCylinder('house fan', {
        height: 1, diameterTop: .18, diameterBottom: .035, tessellation: 8, cap: B.Mesh.NO_CAP
      }, scene), rig, lights[side === 1 ? 0 : 1]);
      mesh.rotationQuaternion = new B.Quaternion();
      beams.push({ mesh, side, i, origin });
    }
  }
  // A single pair opens out above the audience during the phrase release.
  const pair = [-1, 1].map(side => {
    const material = paint(B, scene, 'phrase laser', side < 0 ? '#55e7ff' : '#fb6bcf', 1);
    material.disableLighting = true;
    material.alphaMode = B.Engine.ALPHA_ADD;
    material.alpha = 0;
    const ray = attach(B.MeshBuilder.CreateCylinder('phrase laser ray', {
      height: 1, diameterTop: .12, diameterBottom: .065, tessellation: 8, cap: B.Mesh.NO_CAP
    }, scene), rig, material);
    ray.rotationQuaternion = new B.Quaternion();
    ray.setEnabled(false);
    return { side, ray, material, origin: new B.Vector3(side * 4.2, 4.7, -12.2) };
  });
  const delta = new B.Vector3();
  return (beat, visible, release, bpm=120, energy=0, strobing=false,preview=null,playing=true,arrangement=1) => {
    const cue=peripheralCue(beat,bpm,preview,playing,arrangement);
    renderPeriphery(beat,bpm,energy,strobing,cue);
    rig.setEnabled(visible&&!cue.preview);
    if (!visible||cue.preview) return;
    for(const material of lights)material.alpha=.065*cue.wash;
    const sweeping = release >= 0 && !calm.matches;
    for (const {side, ray, material, origin} of pair) {
      ray.setEnabled(sweeping);
      if (!sweeping) continue;
      // Reach the acoustic wall before fading, short of the lounge sign at z=10.15.
      const t = Math.min(1, release / .78);
      const spread = t * t * (3 - 2 * t);
      delta.set(side * (4.5 + 17 * spread), 3.45 + 2.8 * spread, -5 + 13 * spread);
      delta.subtractInPlace(origin);
      ray.position.copyFrom(delta).scaleInPlace(.5).addInPlace(origin);
      ray.scaling.y = delta.length();
      B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, delta.normalize(), ray.rotationQuaternion);
      material.alpha = .9 * Math.min(1, release / .12, (1 - release) / .22);
    }
    const phase = calm.matches ? 0 : beat * Math.PI / 16;
    for (const {mesh, side, i, origin} of beams) {
      delta.set(side * (i * 3.3 - 6 + 4 * Math.sin(phase + i * .22)), 3.8 + i * .32, 9 + i * 1.8);
      delta.subtractInPlace(origin);
      mesh.position.copyFrom(delta).scaleInPlace(.5).addInPlace(origin);
      mesh.scaling.y = delta.length();
      B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, delta.normalize(), mesh.rotationQuaternion);
    }
  };
}

function lasers(B, scene, root, event, fastFlash) {
  const optics = new B.TransformNode('laser optics', scene);
  optics.parent = root;
  root = optics;
  const cuts = laserBlackouts(event.start);
  const lime = '#cfff3c', violet = '#bc3aff', amber = '#ffae1e';
  const spectrum = ['#30ecff', '#fe309b', '#4673ff', '#6bff56', '#ffd540', '#ff4141'];
  const palette = Object.fromEntries([...spectrum, lime, violet, amber].map(hex => [hex, B.Color3.FromHexString(hex)]));
  const gradient = new B.DynamicTexture('spotlight falloff', 64, scene, false);
  const ctx = gradient.getContext();
  const pool = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  pool.addColorStop(0, '#ffffff');
  pool.addColorStop(0.35, '#aaaaaa');
  pool.addColorStop(1, '#000000');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, 64, 64);
  gradient.getAlphaFromRGB = true;
  gradient.update();

  function beam(name, top, bottom, material) {
    const mesh = attach(B.MeshBuilder.CreateCylinder(name, {
      height: 1, diameterTop: top, diameterBottom: bottom, tessellation: 10,
      cap: B.Mesh.NO_CAP,
    }, scene), root, material);
    mesh.rotationQuaternion = new B.Quaternion();
    return mesh;
  }
  const direction = new B.Vector3();
  function aim(mesh, origin, target) {
    target.subtractToRef(origin, direction);
    mesh.position.copyFrom(origin).addInPlace(direction.scale(0.5));
    mesh.scaling.y = direction.length();
    B.Quaternion.FromUnitVectorsToRef(B.Axis.Y, direction.normalize(), mesh.rotationQuaternion);
  }

  // Eight overhead heads on a circular truss project shafts and matching pools on the floor.
  const heads = Array.from({ length: 8 }, (_, i) => {
    const angle = Math.PI * i / 4;
    const origin = new B.Vector3(8.45 * Math.cos(angle), 7.59, 8.45 * Math.sin(angle));
    const light = paint(B, scene, 'shaft glow', '#ffffff');
    light.disableLighting = true;
    light.alphaMode = B.Engine.ALPHA_ADD;
    light.alpha = 0.15;
    const core = paint(B, scene, 'beam core', '#ffffff');
    core.disableLighting = true;
    const shaft = beam('overhead shaft', 0.75, 0.10, light);
    const ray = beam('overhead core', 0.13, 0.05, core);
    const lens = attach(B.MeshBuilder.CreateSphere('moving head lens', {diameter: 0.28, segments: 8}, scene), root, core);
    lens.position.copyFrom(origin);
    const casing=paint(B,scene,'moving head housing','#242033');
    const body=attach(B.MeshBuilder.CreateCylinder('laser fixture housing',{height:.45,diameter:.44,tessellation:8},scene),root,casing);
    body.rotationQuaternion=new B.Quaternion();
    const mount=attach(B.MeshBuilder.CreateBox('laser truss mount',{width:.46,height:.22,depth:.48},scene),root,casing);
    mount.position.copyFrom(origin);mount.position.y+=.45;
    const footprint = paint(B, scene, 'floor wash', '#ffffff');
    footprint.disableLighting = true;
    footprint.opacityTexture = gradient;
    footprint.emissiveTexture = gradient;
    footprint.alphaMode = B.Engine.ALPHA_ADD;
    footprint.alpha = 0.52;
    const spot = attach(B.MeshBuilder.CreateGround('floor pool', {width: 3.8, height: 3.8}, scene), root, footprint);
    return {angle, origin, shaft, ray, light, core, body, spot, footprint};
  });
  const fanMaterials = spectrum.map(hex => paint(B, scene, 'scanner beam', hex));
  const fans = Array.from({length: 28}, (_, i) => {
    const side = i < 14 ? -1 : 1;
    return {
      side, spread: (i % 14) / 13 * 2 - 1,
      origin: new B.Vector3(side * 6.7, 4.2, -15.6),
      mesh: beam('scanning fan', 0.065, 0.018, fanMaterials[i % spectrum.length]),
    };
  });
  const target = new B.Vector3();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  return t => {
    const ms = Math.round(t * 1000);
    // One two-second strobe in the middle of the sixteen-second performance.
    const rapidCue = fastFlash() && ms >= 7000 && ms < 9000;
    const blackout = rapidCue ? Math.floor((ms - 7000) / 100) % 2 === 1
      : cuts.some(([start, end]) => t >= start && t < end);
    const lightsOn = reducedMotion.matches || !blackout;
    root.setEnabled(lightsOn);
    if (!lightsOn) return;
    const musicalBeat = t * (event.bpm || 120) / 60;
    const phase = Math.min(3, Math.floor(musicalBeat / 8));
    for (const [i, head] of heads.entries()) {
      const a = head.angle + musicalBeat * .36;
      const color = palette[phase === 0 ? (i % 2 ? lime : violet)
        : phase === 2 ? amber : spectrum[(i + phase) % spectrum.length]];
      for (const mat of [head.core, head.light, head.footprint]) mat.emissiveColor.copyFrom(color);
      const side = i % 2 ? 1 : -1;
      if (phase === 0) target.set(8 * Math.cos(a), .08, 3 + 8 * Math.sin(a));
      if (phase === 1) target.set(side * (11 + 6 * Math.sin(a)), .08, 7 + 8 * Math.cos(a));
      if (phase === 2) target.set(17 * Math.cos(a), .08, 9 + 10 * Math.sin(a));
      if (phase === 3) target.set(side * (8 + 8 * Math.sin(a)), .08, 16 + 3.5 * Math.cos(a));
      aim(head.shaft, head.origin, target);
      aim(head.ray, head.origin, target);
      head.body.rotationQuaternion.copyFrom(head.ray.rotationQuaternion);
      head.body.position.copyFrom(head.origin).subtractInPlace(direction.scale(.20));
      head.spot.position.set(target.x, .08, target.z);
    }
    for (const {mesh, origin, side, spread} of fans) {
      mesh.setEnabled(phase === 1 || phase === 3);
      if (!mesh.isEnabled()) continue;
      if (phase === 1) {
        target.set(-side * 12 + spread * 8, 3.8 + 1.7 * spread * side + Math.sin(t * 1.8), 20 + spread * 3);
      } else {
        const angle = t * 1.15 + spread * 1.5;
        target.set(-side * 14 + 6 * Math.cos(angle), 4.8 + 1.8 * Math.sin(angle) * side, 9 + 12 * Math.cos(angle * 0.6));
      }
      aim(mesh, origin, target);
    }
  };
}

// Original faceted phoenix: paired articulated wings, tapered flight feathers and a forked tail.
function phoenix(B, scene, root) {
  const bird = new B.TransformNode('phoenix flight', scene);
  bird.parent = root;
  const gold = paint(B, scene, 'sun gold', '#ffbd42', 0.78);
  const fire = paint(B, scene, 'vermillion', '#e3331b', 0.46);
  const rose = paint(B, scene, 'ember', '#b91e50', 0.42);
  const pearl = paint(B, scene, 'ivory flame', '#fff0b0', 0.84);
  const V = (x,y,z) => new B.Vector3(x,y,z);
  function oval(name, pos, size, mat) {
    const mesh = attach(B.MeshBuilder.CreateSphere(name, {segments: 8, diameter: 1}, scene), bird, mat);
    mesh.position.copyFrom(pos);
    mesh.scaling.copyFrom(size);
    return mesh;
  }
  function plume(parent, start, end, width, material) {
    const mesh = attach(new B.Mesh('tapered feather', scene), parent, material);
    const middle = B.Vector3.Lerp(start, end, 0.36);
    const side = B.Vector3.Cross(end.subtract(start), B.Axis.Y).normalize().scale(width);
    const points = [start, middle.add(side), end, middle.subtract(side), middle.add(V(0, width * 0.7, 0))];
    const data = new B.VertexData();
    data.positions = points.flatMap(p => p.asArray());
    data.indices = [0,1,4, 1,2,4, 2,3,4, 3,0,4, 0,3,2, 2,1,0];
    data.normals = [];
    B.VertexData.ComputeNormals(data.positions, data.indices, data.normals);
    data.applyToMesh(mesh);
  }
  oval('breast', V(0,0,0), V(1.05,1.15,2.5), fire);
  oval('neck', V(0,0.42,0.9), V(0.64,1.18,0.76), gold);
  oval('head', V(0,0.94,1.14), V(0.82,0.77,0.92), gold);
  plume(bird, V(0,0.95,1.47), V(0,0.78,2.05), 0.21, pearl);
  for (const sign of [-1,1]) {
    oval('eye', V(sign*0.31,1.04,1.4), V(0.13,0.13,0.13), pearl);
    plume(bird, V(sign*0.15,1.15,1.03), V(sign*0.38,1.94,0.38), 0.16, fire);
  }
  const wings = [-1,1].map(sign => {
    const wing = new B.TransformNode('wing', scene);
    wing.parent = bird;
    wing.position.x = sign*0.3;
    plume(wing, V(0,0,0.5), V(sign*3.35,0.56,0.24), 0.68, gold);
    for (let i=0;i<7;i++) {
      const u=i/6;
      plume(wing, V(sign*(0.3+1.95*u),0.18+0.32*u,0.36),
        V(sign*(1.25+3.55*u),0.05+0.7*u,-2.85+2.35*u),0.42-0.16*u,[rose,fire,gold][i%3]);
    }
    return {wing, sign};
  });
  for(let i=-2;i<=2;i++)
    plume(bird,V(i*0.09,-0.05,-0.65),V(i*0.66,-0.62,-4.65+Math.abs(i)*0.65),0.29,[gold,fire,rose,fire,gold][i+2]);
  return t => {
    const u = t / effects.phoenix.seconds;
    bird.scaling.setAll(1.48 * Math.max(0.01, Math.min(1, t/1.2, (1-u)*9)));
    bird.position.set(2+2*Math.sin(2*Math.PI*u),4.4+.4*Math.sin(Math.PI*u),-2+2*Math.sin(Math.PI*u));
    bird.rotation.y = 0.7*Math.cos(2*Math.PI*u);
    bird.rotation.z = -0.12*Math.sin(2*Math.PI*u);
    for (const {wing,sign} of wings) wing.rotation.z = sign*(0.18+0.5*Math.sin(t*3.7));
  };
}

export function eventPlayer(B, scene, now = Date.now, fastFlash = () => false) {
  let current, root, animate, adorn;
  function stop() {
    root?.dispose(false, true);
    root = current = animate = adorn = null;
  }
  function set(event) {
    if (!event || !Object.hasOwn(effects, event.kind)) { stop(); return; }
    if (current?.id === event.id || now() >= event.start + effects[event.kind].seconds*1000) return;
    stop();
    current = event;
    root = new B.TransformNode('stage event', scene);
    const particlePreview = ['fountain','confetti'].includes(event.kind);
    animate = particlePreview ? null : ['whale','dragon','jellyfish','butterflies'].includes(event.kind)
      ? hologram(B, scene, root, event.kind)
      : {led: marquee, laser: lasers, phoenix}[event.kind](B, scene, root, event, fastFlash);
    adorn = event.kind === 'led' ? null : celebration(B, scene, root, effects[event.kind].seconds,
      !particlePreview && event.kind !== 'laser', particlePreview ? event.kind : 'both', event.bpm || 120);
    tick();
  }
  function tick() {
    if (!current) return;
    const t = Math.max(0, (now()-current.start)/1000);
    if (t >= effects[current.kind].seconds) stop();
    else {
      animate?.(t);
      adorn?.(t);
    }
  }
  scene.onBeforeRenderObservable.add(tick);
  return {set, stop, get kind() { return current?.kind; },
    get strobing() {
      const elapsed = current ? now() - current.start : -1;
      return current?.kind === 'laser' && fastFlash() &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches && elapsed >= 7000 && elapsed < 9000;
    }
  };
}
