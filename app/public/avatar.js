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
