// These identifiers are transmitted in the existing actor action field.
export const dances = new Map([
  ['groove', '그루브'],
  ['side-step', '사이드 스텝'],
  ['disco-point', '디스코 포인트'],
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
  const strength=musical?Math.max(.32,Math.min(1,.20+.65*arrangement+.15*drive)):1;
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
