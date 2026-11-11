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
  const wandMaterial = new B.StandardMaterial('turquoise light stick', scene);
  wandMaterial.disableLighting = true;
  wandMaterial.emissiveColor = B.Color3.FromHexString('#67fff2');
  const trailMaterial = new B.StandardMaterial('light stick afterglow', scene);
  trailMaterial.emissiveColor = wandMaterial.emissiveColor;
  trailMaterial.disableLighting = true;
  trailMaterial.alpha = 0.23;
  const distantBlocks = new Map();
  const blockMaterial = new B.StandardMaterial('crowd blocks', scene);
  function block(parent, name, width, height, depth, y, material) {
    const mesh = B.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.parent = parent;
    mesh.position.y = y;
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }
  function distantGuest(root, shirt) {
    if (!distantBlocks.has(shirt)) {
      const parts = [];
      function part(x, y, w, h, d, color) {
        const mesh = block(null, 'crowd part', w, h, d, y, blockMaterial);
        mesh.position.x = x;
        const colors = [];
        for (let i = 0; i < mesh.getTotalVertices(); i++)
          colors.push(color.r, color.g, color.b, 1);
        mesh.setVerticesData(B.VertexBuffer.ColorKind, colors);
        parts.push(mesh);
      }
      part(0, .78, .34, .33, .32, face.diffuseColor);
      part(0, .28, .50, .61, .30, shirt.diffuseColor);
      for (const sign of [-1, 1]) {
        part(sign * .33, .28, .13, .54, .19, shirt.diffuseColor);
        part(sign * .13, -.40, .20, .70, .26, leg.diffuseColor);
      }
      const template = B.Mesh.MergeMeshes(parts, true);
      template.setEnabled(false);
      distantBlocks.set(shirt, template);
    }
    return distantBlocks.get(shirt).createInstance(root.name + ' distant blocks');
  }
  // Share articulated block meshes across guests, including their distant dance poses.
  const blockTemplates = new Map();
  function guestPart(parent, name, w, h, d, y, material) {
    const key = name + ':' + material.uniqueId;
    let template = blockTemplates.get(key);
    if (!template) {
      template = block(null, name, w, h, d, 0, material);
      template.setEnabled(false);
      blockTemplates.set(key, template);
    }
    const mesh = template.createInstance(name);
    mesh.parent = parent;
    mesh.position.y = y;
    mesh.isPickable = false;
    return mesh;
  }
  return function make(actor, featuredWand = false) {
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
    const torso = actor.ai ? guestPart(near, 'block torso', .50, .61, .30, 1.06, shirt)
      : capsule(near, 'torso', 0.23, 0.72, 1.04, shirt);
    if (actor.ai) guestPart(near, 'block head', .34, .33, .32, 1.55, face);
    else capsule(near, 'head', 0.15, 0.32, 1.55, face);
    const limbs = [];
    for (const sign of [-1, 1]) {
      for (const arm of [true, false]) {
        const joint = new B.TransformNode('joint', scene);
        joint.parent = near;
        joint.position.set(sign * (arm ? 0.25 : 0.115), arm ? 1.33 : 0.79, 0);
        if (actor.ai) {
          joint.position.x = sign * (arm ? .32 : .13);
          guestPart(joint, arm ? 'block arm' : 'block leg', arm ? .15 : .2,
            arm ? .55 : .73, arm ? .18 : .26, arm ? -.25 : -.34, arm ? shirt : leg);
        } else capsule(
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
    const far = actor.ai ? distantGuest(root, shirt) : capsule(root, 'distant avatar', 0.22, 1.56, 0.79, shirt);
    far.parent = root;
    far.position.y = .79;
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
    let wand, tip, trail, orbit, previousTip, previousTime = 0;
    function showWand(visible, detailed) {
      if (!visible && !wand) return;
      if (!wand) {
        wand = B.MeshBuilder.CreateCylinder('mood wand', { height: featuredWand ? 0.83 : 0.54, diameter: featuredWand ? 0.105 : 0.065, tessellation: 8 }, scene);
        wand.material = wandMaterial;
        wand.isPickable = false;
        tip = new B.TransformNode('wand tip', scene);
        tip.parent = wand;
        tip.position.y = featuredWand ? -0.415 : -0.27;
      }
      wand.parent = detailed ? limbs[2] : root;
      wand.position.set(detailed ? -0.117 : 0.38, detailed ? (featuredWand ? -0.88 : -0.753) : 1.28, detailed ? 0 : 0.12);
      wand.rotation.z = detailed ? -0.45 : -0.85;
      wand.setEnabled(visible);
      const drawTrail = visible && detailed && root.isEnabled();
      if (drawTrail && !trail) {
        tip.computeWorldMatrix(true);
        trail = new B.TrailMesh('wand sweep', tip, scene, { diameter: featuredWand ? .14 : .055, length: featuredWand ? 9 : 5, sections: 3 });
        trail.material = trailMaterial;
        trail.isPickable = false;
      } else if (!drawTrail && trail) {
        trail.dispose();
        trail = null;
      }
      if (drawTrail) {
        tip.computeWorldMatrix(true);
        const point = tip.getAbsolutePosition(), now = performance.now();
        const speed = previousTip ? B.Vector3.Distance(point,previousTip)/Math.max(.016,(now-previousTime)/1000) : 0;
        const sweep = Math.min(1,speed/3.5);
        trail.diameter = .035 + sweep*(featuredWand ? .20 : .13);
        if(!orbit) {
          orbit=B.MeshBuilder.CreateTorus('wand body orbit',{diameter:1.12,thickness:.018,tessellation:32},scene);
          orbit.parent=root;orbit.position.y=1.03;orbit.material=trailMaterial;orbit.isPickable=false;
        }
        orbit.setEnabled(sweep>.15);
        orbit.rotation.z=.16*Math.sin(now/420);
        orbit.visibility=sweep*.55;
        previousTip=point.clone();previousTime=now;
      } else {
        previousTip=null;
        orbit?.setEnabled(false);
      }
    }
    return {
      showWand,
      root,
      near,
      far,
      limbs,
      torso,
      actor,
      label,
      dispose() {
        glow?.removeExcludedMesh(label);
        trail?.dispose();
        root.dispose();
        mat.dispose();
        tex.dispose();
      },
    };
  };
}

// The walking camera stays at the player's eyes for input, collisions and network movement.
export function playerView(B, scene, cam, canvas, eyeHeight, controls, { followDistance = 3.4, followLift = 0.32, followFov = cam.fov, maxDistance = 9, cameraLimit = null, arrivalSeconds = 0 } = {}) {
  const follow = new B.FreeCamera('third person', B.Vector3.Zero(), scene);
  const seatedEye = new B.FreeCamera('activity eyes', B.Vector3.Zero(), scene);
  seatedEye.minZ = cam.minZ;
  seatedEye.fov = cam.fov;
  follow.minZ = cam.minZ;
  follow.fov = followFov;
  const button = document.createElement('button');
  button.type = 'button';
  button.title = '3인칭 거리 조절: 화면 위에서 마우스 휠을 사용하세요.';
  if (controls === document.body)
    button.style.cssText = 'position:fixed;top:12px;right:12px;background:#21172a;color:white;border:1px solid #ddd8;';
  controls.append(button);

  let thirdPerson = true, model, activity, fixed, preview;
  const defaultDistance = followDistance;
  let zoomDistance = defaultDistance;
  let arrivalStart=null,arrivalSeen=false;
  const calmArrival=matchMedia('(prefers-reduced-motion: reduce)');
  const cancelArrival=()=>{arrivalStart=null;arrivalSeen=true;};
  const keyArrival=event=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))cancelArrival();};
  canvas.addEventListener('pointerdown',cancelArrival);
  window.addEventListener('keydown',keyArrival);
  function wheel(event) {
    if (!thirdPerson || preview || event.ctrlKey || !event.deltaY) return;
    event.preventDefault();
    cancelArrival();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    zoomDistance = Math.max(1.2, Math.min(maxDistance, zoomDistance * Math.exp(event.deltaY * unit * 0.002)));
  }
  canvas.addEventListener('wheel', wheel, { passive: false });
  scene.onDisposeObservable.addOnce(() => {
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('pointerdown',cancelArrival);
    window.removeEventListener('keydown',keyArrival);
  });

  function select() {
    scene.activeCamera = preview || (!model ? cam : thirdPerson ? activity?.camera || follow : fixed ? seatedEye : cam);
    if (model) model.root.setEnabled(thirdPerson);
    button.disabled = Boolean(preview);
  }
  function label() {
    button.textContent = thirdPerson ? '3인칭 · 1인칭으로 전환' : '1인칭 · 3인칭으로 전환';
  }
  button.onclick = () => {
    cancelArrival();
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
    if (!thirdPerson || preview) return;
    const camera = activity?.camera || follow;
    const target = activity?.target || model.root.position.add(new B.Vector3(0, 1.25, 0));
    let direction, length;
    if (activity) {
      direction = activity.offset.normalizeToNew();
      length = activity.offset.length() * zoomDistance / defaultDistance;
    } else {
      direction = cam.getForwardRay().direction.negate();
      direction.y += followLift;
      direction.normalize();
      length = zoomDistance;
    }
    if(arrivalStart!==null) {
      const progress=Math.min(1,(performance.now()-arrivalStart)/(arrivalSeconds*1000));
      const remaining=1-progress*progress*(3-2*progress);
      direction.y+=remaining*.85;direction.normalize();
      length+=(Math.max(defaultDistance*1.2,length)-length)*remaining;
      if(progress>=1)arrivalStart=null;
    }
    if(cameraLimit)length=cameraLimit(target,direction,length);
    const hit = scene.pickWithRay(new B.Ray(target, direction, length),
      mesh => mesh.checkCollisions || mesh.name.startsWith('wall/') || mesh.name.startsWith('floor/'));
    const distance = hit?.hit ? Math.max(0.08, hit.distance - 0.12) : length;
    camera.position.copyFrom(target).addInPlace(direction.scale(distance));
    camera.setTarget(target);
  });
  return {
    actor(next, activityCamera = null, stationary = false) {
      model = next;
      if(model&&!arrivalSeen){arrivalSeen=true;if(arrivalSeconds>0&&!calmArrival.matches)arrivalStart=performance.now();}
      activity = activityCamera;
      if (activity) activity.offset = activity.camera.position.subtract(activity.target);
      fixed = stationary;
      select();
    },
    preview(camera) {
      preview = camera;
      select();
    },
  };
}

// Adult staff silhouettes are separate from the default player and block guests.
export function staffNPC(B,scene,make,role) {
  const dj=role==='dj';
  const actor={id:dj?'house-dj':'house-bartender',ai:false,avatar:dj?'indigo':'teal',
    nickname:dj?'DJ':'바 직원',x:dj?0:-13.6,y:dj?1.35:0,z:dj?-15.4:17.4,yaw:dj?0:Math.PI};
  const model=make(actor),own=[];
  model.root.metadata={ageGroup:'adult',gender:'woman',role,decorative:true};
  const fabric=model.torso.material.clone(role+' fitted blouse');own.push(fabric);
  fabric.diffuseColor=B.Color3.FromHexString(dj?'#9a3d90':'#258f92');
  fabric.emissiveColor=fabric.diffuseColor.scale(.12);
  const source=model.torso.material;
  for(const mesh of model.near.getChildMeshes())if(mesh.material===source)mesh.material=fabric;
  function material(name,color){
    const ink=new B.StandardMaterial(role+' '+name,scene);ink.diffuseColor=B.Color3.FromHexString(color);own.push(ink);return ink;
  }
  const hair=material('hair',dj?'#291c39':'#4a2c2c'),dark=material('uniform trim','#161326');
  const eyes=material('face details','#241a2b'),accent=material('uniform accent',dj?'#f16bcd':'#d3a862');
  function part(name,kind,options,position,ink,parent=model.near){
    const mesh=B.MeshBuilder[kind](role+' '+name,options,scene);
    mesh.parent=parent;mesh.position.set(...position);mesh.material=ink;mesh.isPickable=false;return mesh;
  }
  // The rounded upper-body volumes use the same opaque blouse as the torso.
  for(const side of [-1,1]) {
    const chest=part('clothed upper torso','CreateSphere',{diameter:.35,segments:12},[side*.14,1.22,.15],fabric);
    chest.scaling.set(1,.94,1.15);
    part('side hair','CreateCapsule',{radius:.065,height:.48,tessellation:8},[side*.17,1.5,-.015],hair);
    part('eye','CreateBox',{width:.035,height:.042,depth:.012},[side*.062,1.58,.155],eyes);
  }
  const hips=part('uniform hips','CreateSphere',{diameter:.54,segments:12},[0,.79,0],dark);
  hips.scaling.set(1,.55,.65);
  part('waist band','CreateBox',{width:.45,height:.065,depth:.34},[0,.89,0],dark);
  const crown=part('hair crown','CreateSphere',{diameter:.40,segments:12},[0,1.72,-.03],hair);
  crown.scaling.set(1,.65,.95);
  part('back hair','CreateCapsule',{radius:.17,height:dj?.46:.61,tessellation:8},[0,dj?1.50:1.38,-.14],hair);
  part('mouth','CreateBox',{width:.062,height:.014,depth:.012},[0,1.48,.16],accent);
  part('staff badge','CreateBox',{width:.075,height:.045,depth:.018},[-.13,1.365,.17],accent);
  if(dj) {
    for(const side of [-1,1])part('headphone ear','CreateBox',{width:.08,height:.19,depth:.22},[side*.205,1.61,0],dark);
    part('headphone band','CreateBox',{width:.47,height:.055,depth:.13},[0,1.82,0],dark);
  } else {
    part('apron','CreateBox',{width:.44,height:.38,depth:.035},[0,.70,.17],dark);
    part('apron pocket','CreateBox',{width:.22,height:.11,depth:.02},[0,.72,.195],accent);
    const metal=material('shaker steel','#b4b5c3');
    part('shaker','CreateCylinder',{height:.24,diameter:.09,tessellation:10},[0,-.49,.02],metal,model.limbs[2]);
    part('shaker cap','CreateCylinder',{height:.055,diameter:.065,tessellation:10},[0,-.35,.02],metal,model.limbs[2]);
  }
  // Keep bright counter lamps from bleaching staff skin and clothing.
  const privateMaterials=new Map();
  for(const mesh of model.near.getChildMeshes()) {
    if(mesh.material&&!own.includes(mesh.material)) {
      if(!privateMaterials.has(mesh.material)) {
        const ink=mesh.material.clone(role+' '+mesh.material.name);own.push(ink);privateMaterials.set(mesh.material,ink);
      }
      mesh.material=privateMaterials.get(mesh.material);
    }
    if(mesh.material?.specularColor)mesh.material.specularColor.set(0,0,0);
    for(const light of scene.lights)if(light.getTypeID()!==3)light.excludedMeshes.push(mesh);
  }
  model.root.scaling.setAll(1.1);
  model.far.setEnabled(false);model.label.setEnabled(!dj);
  const dispose=model.dispose.bind(model);
  model.dispose=()=>{dispose();own.forEach(ink=>ink.dispose());};
  return model;
}
export function animateStaff(model,role,beats,seconds,energy=0,reduced=false) {
  const pulse=reduced?0:Math.sin(beats*Math.PI*2),slow=reduced?0:Math.sin(seconds*1.8);
  if(role==='bartender') {
    model.near.rotation.y=slow*.055;
    model.near.rotation.z=slow*.025;
    model.limbs[0].rotation.x=-1.28+slow*.10;
    model.limbs[2].rotation.x=-1.48+slow*.16;
    model.limbs[0].rotation.z=-.12;
    model.limbs[2].rotation.z=.10;
  } else {
    model.limbs[0].rotation.x=-1.24+pulse*.16*(.4+energy*.6);
    model.limbs[2].rotation.x=-1.30-pulse*.13*(.4+energy*.6);
    model.limbs[0].rotation.z=-.15;model.limbs[2].rotation.z=.15;
  }
}
