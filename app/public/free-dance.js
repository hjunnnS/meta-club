// These identifiers are transmitted in the existing actor action field.
export const dances = new Map([
  ['groove', '그루브'],
  ['side-step', '사이드 스텝'],
  ['disco-point', '디스코 포인트'],
  ['hands-up', '팔 올려 점프'],
  ['shuffle-step', '셔플 스텝'],
]);
export function danceButtons(parent, select) {
  const buttons = [];
  for (const [id, label] of dances) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.dance = id;
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => select(id);
    parent.append(b);
    buttons.push(b);
  }
  return (action, disabled = false) => {
    for (const b of buttons) {
      b.disabled = disabled;
      b.setAttribute('aria-pressed', String(action === b.dataset.dance));
    }
  };
}

export function danceCamera(B, scene) {
  const cam = new B.FreeCamera('free dance', B.Vector3.Zero(), scene);
  cam.minZ = 0.07;
  return (actor) => {
    const dx = Math.sin(actor.yaw),
      dz = Math.cos(actor.yaw);
    cam.position.set(actor.x + 3 * dx, actor.y + 1.65, actor.z + 3 * dz);
    return { camera: cam, target: new B.Vector3(actor.x, actor.y + 0.95, actor.z) };
  };
}

// One unit is a musical beat. The supporting leg and the reaching arm alternate every beat.
export function animateDance(model, action, beats, style, energy, arrangement=1) {
  const musical=Number.isFinite(energy),drive=musical?Math.max(0,Math.min(1,energy)):0;
  const strength=musical?Math.max(.55,Math.min(1.10,.38+.58*arrangement+.18*drive)):1;
  // Extra styles keep their own choreography; the original three stay intact.
  model.near.position.z=0;
  if(action==='hands-up'||action==='shuffle-step'){
    animateExtraDance(model,action,beats,style,drive,strength);return;
  }
  const pointHold = action === 'disco-point';
  const lead = style === 1 ? (pointHold ? 2 : 1) : 0;
  const facing = style === 0 ? -0.23 : style === 1 ? 0.21 : 0;
  const cycle = (beats + lead) * Math.PI;
  const weight = musical?Math.tanh(2.2*Math.sin(cycle))/Math.tanh(2.2):Math.sin(cycle);
  const lift = Math.abs(weight);
  const rebound = Math.sin(2 * cycle - 0.45);
  const side = action === 'side-step', point = action === 'disco-point';
  const accent = Math.tanh(3.6 * Math.sin(cycle / 2));
  model.near.position.x = side ? 0.40 * weight : point ? 0.12 * accent : 0.13 * weight;
  model.near.position.y = side ? -0.065 * lift : point ? 0.065 * lift : 0.11 * rebound;
  const footPhase=((beats+lead)%1+1)%1;
  const landing=musical?Math.exp(-footPhase/.13)*(.035+.035*drive):0;
  model.near.position.y-=landing;
  model.near.rotation.z = side ? -0.18 * weight : point ? -0.19 * accent : 0.2 * weight;
  model.near.rotation.y = facing + (point ? 0.34 : 0.19) * Math.sin(cycle - 0.35);
  model.torso.rotation.z = (0.11+drive*.035) * Math.sin(cycle - (musical?.70:.5));
  model.limbs.forEach((joint, i) => {
    const sign = i < 2 ? -1 : 1;
    const raised = Math.max(0, sign * weight);
    if (i % 2 === 0) {
      joint.rotation.x = side ? -0.48 + sign * 0.69 * weight : -0.48 + 0.48 * (musical?Math.sin(2*cycle-.65):rebound);
      joint.rotation.z = sign * (point ? 0.18 + 2.66 * (1 + sign * accent) / 2
        : side ? 0.30 + 0.32 * raised : 0.8 + 0.56 * Math.sin(2 * cycle - sign * 0.42));
    } else {
      joint.rotation.x = 0.5 * raised - 0.14;
      joint.rotation.z = sign * (side ? 0.18 + 0.94 * raised : 0.08 + 0.24 * raised);
    }
  });
  // Scale expressive offsets, keeping the supporting foot and neutral stance stable.
  model.near.position.x*=strength;model.near.position.y*=strength;
  model.near.rotation.z*=strength;
  model.near.rotation.y=facing+(model.near.rotation.y-facing)*strength;
  model.torso.rotation.z*=strength;
  model.limbs.forEach((joint,i)=>{
    const sign=i<2?-1:1;
    const neutralX=i%2===0?-.48:-.14;
    const neutralZ=sign*(i%2===0?.18:.08);
    joint.rotation.x=neutralX+(joint.rotation.x-neutralX)*strength;
    joint.rotation.z=neutralZ+(joint.rotation.z-neutralZ)*strength;
  });
}

// Distinct silhouettes: raised arms with beat jumps, or fast heel-toe footwork.
function animateExtraDance(model,action,beats,style,drive,strength){
  const b=beats+(style===1?1:0),phase=((b%1)+1)%1,cycle=b*Math.PI*2;
  const weight=Math.sin(cycle),sway=Math.sin(cycle/2),jump=action==='hands-up';
  const bend=phase<.16?-.09*Math.sin(phase/.16*Math.PI):0;
  const air=phase>=.16&&phase<.84?Math.sin((phase-.16)/.68*Math.PI):0;
  const facing=style===0?-.23:style===1?.21:0;
  model.near.position.x=(jump?.045*sway:.15*sway)*strength;
  model.near.position.y=(jump?bend+(.26+.08*drive)*air:-.045*Math.abs(weight))*strength;
  model.near.position.z=jump?0:.12*weight*strength;
  model.near.rotation.set(0,facing+(jump?.08:.22)*sway,(jump?.045:.075)*weight*strength);
  model.torso.rotation.z=(jump?.055:.09)*sway*strength;
  model.limbs.forEach((joint,i)=>{
    const side=i<2?-1:1,arm=i%2===0;
    if(arm){
      joint.rotation.x=jump?-.18+.14*weight:-.62+side*.45*weight*strength;
      joint.rotation.z=side*(jump?2.62+.20*sway*strength:.40+.15*Math.sin(cycle+side*.6)*strength);
    }else{
      joint.rotation.x=jump?-.14+.45*air*strength:-.14+side*.78*weight*strength;
      joint.rotation.z=side*(jump?.12+.20*air*strength:.08+.12*Math.max(0,side*weight)*strength);
    }
  });
}

// Optional right-arm layer. Lowering the wand leaves all five base dances intact.
export function animateWandDance(model,action,beats,energy=0,reduced=false){
  if(!dances.has(action))return null;
  const b=reduced?0:Math.max(0,beats),phase=b%16;
  const big=Math.floor(b/16)%2,previous=b<16?0:1-big;
  const fade=Math.min(1,phase/1.5),ease=fade*fade*(3-2*fade);
  const large=previous+(big-previous)*ease;
  const gain=(.45+.55*large)*(.75+.25*Math.max(0,Math.min(1,energy)));
  const wave=Math.sin(b*Math.PI),fast=Math.sin(b*Math.PI*2),arm=model.limbs[2];
  let roll=-.16,pitch=0;
  if(action==='groove'){
    arm.rotation.z=1.38+.38*wave*gain;arm.rotation.x=-.22+.18*fast*gain;
    roll=-.16+.16*wave*gain;
  }else if(action==='side-step'){
    arm.rotation.z=1.25+.55*wave*gain;arm.rotation.x=-.35+.40*wave*gain;
    roll=-.12+.23*wave*gain;pitch=.12*fast*gain;
  }else if(action==='disco-point'){
    const reach=.5-.5*Math.cos(b*Math.PI/2);
    arm.rotation.z=.75+(1.40+.55*gain)*reach;arm.rotation.x=-.20-.25*(1-reach);
    roll=-.12+.20*reach;pitch=.06*fast;
  }else if(action==='hands-up'){
    arm.rotation.z=2.65+.22*wave*gain;arm.rotation.x=-.10+.20*fast*gain;
    roll=.20*fast*gain;pitch=.10*wave*gain;
  }else{
    arm.rotation.z=.48+.12*fast*gain;arm.rotation.x=-.60+.48*fast*gain;
    roll=-.10+.15*fast*gain;pitch=.15*wave*gain;
  }
  return {roll,pitch,large,sweep:large*(.55+.45*Math.abs(wave)),reduced};
}
