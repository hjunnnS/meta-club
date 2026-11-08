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
    cam.setTarget(new B.Vector3(actor.x, actor.y + 0.95, actor.z));
    scene.activeCamera = cam;
  };
}

export function animateDance(model, action, seconds) {
  const phase = seconds * Math.PI * 4,
    beat = Math.sin(phase),
    sway = Math.sin(phase / 2);
  const step = action === 'side-step',
    point = action === 'disco-point';
  model.near.position.x = step ? 0.28 * sway : 0;
  model.near.position.y = (point ? 0.05 : step ? 0.08 : 0.14) * Math.abs(beat);
  model.torso.rotation.z = (step ? 0.12 : point ? 0.19 : 0.09) * sway;
  model.limbs.forEach((joint, i) => {
    const sign = i < 2 ? -1 : 1,
      arm = i % 2 === 0;
    const raised = point && sign > 0 === sway > 0;
    joint.rotation.x = arm
      ? step
        ? sign * 0.6 * sway
        : -0.35 + 0.24 * beat
      : sign * (step ? 0.62 : 0.25) * beat;
    joint.rotation.z = arm
      ? sign * (raised ? 2.52 : point ? 0.46 : step ? 0.33 : 0.9 + 0.65 * beat)
      : step
        ? sign * 0.23 * Math.abs(sway)
        : 0;
  });
}
