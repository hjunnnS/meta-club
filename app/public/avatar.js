const colors = { indigo: '#8973F2', teal: '#49C8B1', rose: '#F28BAB', gold: '#FFCC55' };
export function avatarFactory(B, scene, glow) {
  const materials = new Map();
  for (const [name, hex] of Object.entries(colors)) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor.scale(0.25);
    materials.set(name, m);
  }
  const face = new B.StandardMaterial('face', scene);
  face.diffuseColor = new B.Color3(0.87, 0.66, 0.49);
  const leg = new B.StandardMaterial('denim', scene);
  leg.diffuseColor = new B.Color3(0.095, 0.09, 0.15);
  return function make(actor) {
    const root = new B.TransformNode(actor.id, scene);
    const near = new B.TransformNode('detail', scene);
    near.parent = root;
    const capsule = (parent, name, radius, height, y, material) => {
      const mesh = B.MeshBuilder.CreateCapsule(
        name,
        { radius, height, tessellation: 8, subdivisions: 1 },
        scene,
      );
      mesh.parent = parent;
      mesh.position.y = y;
      mesh.material = material;
      mesh.isPickable = false;
      return mesh;
    };
    const shirt = materials.get(actor.avatar) || materials.get('indigo');
    const torso = capsule(near, 'torso', 0.23, 0.72, 1.04, shirt);
    capsule(near, 'head', 0.15, 0.32, 1.55, face);
    const limbs = [];
    for (const sign of [-1, 1]) {
      for (const arm of [true, false]) {
        const joint = new B.TransformNode('joint', scene);
        joint.parent = near;
        joint.position.set(sign * (arm ? 0.25 : 0.115), arm ? 1.33 : 0.79, 0);
        capsule(
          joint,
          arm ? 'arm' : 'leg',
          arm ? 0.075 : 0.095,
          arm ? 0.55 : 0.73,
          arm ? -0.25 : -0.34,
          arm ? shirt : leg,
        );
        limbs.push(joint);
      }
    }
    const far = capsule(root, 'distant avatar', 0.22, 1.56, 0.79, shirt);
    far.setEnabled(false);
    const label = B.MeshBuilder.CreatePlane(
      'name',
      { width: 1.55, height: 0.34, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    label.parent = root;
    label.position.y = 1.98;
    label.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    label.isPickable = false;
    const tex = new B.DynamicTexture('name', { width: 512, height: 96 }, scene, false);
    tex.hasAlpha = true;
    tex.drawText(
      actor.nickname.slice(0, 18),
      null,
      66,
      'bold 44px sans-serif',
      actor.ai ? '#ffdb76' : 'white',
      'transparent',
      true,
    );
    const mat = new B.StandardMaterial('name material', scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    glow?.addExcludedMesh(label);
    mat.emissiveColor = B.Color3.White();
    mat.disableLighting = true;
    label.material = mat;
    root.position.set(actor.x, actor.y, actor.z);
    root.rotation.y = actor.yaw;
    return {
      root,
      near,
      far,
      limbs,
      torso,
      actor,
      label,
      dispose() {
        glow?.removeExcludedMesh(label);
        root.dispose();
        mat.dispose();
        tex.dispose();
      },
    };
  };
}

// The walking camera stays at the player's eyes for input, collisions and network movement.
export function playerView(B, scene, cam, canvas, eyeHeight, controls) {
  const follow = new B.FreeCamera('third person', B.Vector3.Zero(), scene);
  const seatedEye = new B.FreeCamera('activity eyes', B.Vector3.Zero(), scene);
  seatedEye.minZ = cam.minZ;
  seatedEye.fov = cam.fov;
  follow.minZ = cam.minZ;
  follow.fov = cam.fov;
  const button = document.createElement('button');
  button.type = 'button';
  if (controls === document.body)
    button.style.cssText = 'position:fixed;top:12px;right:12px;background:#21172a;color:white;border:1px solid #ddd8;';
  controls.append(button);

  let thirdPerson = true, model, activity, fixed, preview;
  function select() {
    scene.activeCamera = preview || (thirdPerson ? activity || follow : fixed ? seatedEye : cam);
    if (model) model.root.setEnabled(thirdPerson);
    button.disabled = Boolean(preview);
  }
  function label() {
    button.textContent = thirdPerson ? '3인칭 · 1인칭으로 전환' : '1인칭 · 3인칭으로 전환';
  }
  button.onclick = () => {
    thirdPerson = !thirdPerson;
    label();
    select();
    canvas.focus();
  };
  label();
  select();

  scene.onBeforeRenderObservable.add(() => {
    if (scene.activeCamera !== cam) cam.update();
    if (!model) return;
    if (!fixed) {
      model.root.position.copyFrom(cam.position);
      model.root.position.y -= eyeHeight;
      model.root.rotation.y = cam.rotation.y;
    } else if (!thirdPerson) {
      seatedEye.rotation.copyFrom(cam.rotation);
      seatedEye.position.copyFrom(model.root.position);
      seatedEye.position.y += eyeHeight - (model.actor.seat != null ? 0.35 : 0);
    }
    if (scene.activeCamera !== follow) return;
    const target = model.root.position.add(new B.Vector3(0, 1.25, 0));
    const direction = cam.getForwardRay().direction.negate();
    direction.y += 0.32;
    direction.normalize();
    const length = 3.4;
    const hit = scene.pickWithRay(new B.Ray(target, direction, length),
      mesh => mesh.checkCollisions || mesh.name.startsWith('wall/') || mesh.name.startsWith('floor/'));
    const distance = hit?.hit ? Math.max(0.08, hit.distance - 0.12) : length;
    follow.position.copyFrom(target).addInPlace(direction.scale(distance));
    follow.setTarget(target);
  });
  return {
    actor(next, activityCamera = null, stationary = false) {
      model = next;
      activity = activityCamera;
      fixed = stationary;
      select();
    },
    preview(camera) {
      preview = camera;
      select();
    },
  };
}
