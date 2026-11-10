// Foot positions in the approved festival GLB (stage/build.py): metres, Y up.
export function edmCameraDistance(target,direction,length) {
  const inside=(x,y,z)=>{
    const arena=Math.abs(x)<=21.7&&Math.abs(z)<=20.7&&Math.abs(x)+Math.abs(z)<=38.9;
    const entry=Math.abs(x)<=3.5&&z>=19.7&&z<=26.4;
    return y>=.20&&y<=7.7&&(arena||entry);
  };
  for(let d=.08;d<=length+.12;d+=.12) {
    const at=Math.min(d,length);
    if(!inside(target.x+direction.x*at,target.y+direction.y*at,target.z+direction.z*at))return Math.max(.08,at-.18);
    if(at===length)break;
  }
  return length;
}

function octagon(dx, dz, halfWidth, halfDepth, corner) {
  return dx <= halfWidth && dz <= halfDepth && dx + dz <= halfWidth + halfDepth - corner;
}
export function edmArea({ x, y, z }) {
  const dx = Math.abs(Math.abs(x) - 14.6),
    side = x < 0 ? 'west' : 'east';
  if (x < 0 && (
    (y >= 3.6 && octagon(dx, Math.abs(z + 13.8), 5.4, 5.9, 0.8)) ||
    (dx <= 1.55 && z >= -8 && z <= 0 && Math.abs(y + z * 0.5) < 0.35)
  )) {
    return { tier: 2, group: side + '-deck' };
  }
  if (octagon(dx, Math.abs(z - 6), 5.1, 5.5, 1.6)) return { tier: 1, group: side + '-dance' };
  let group = 'arena';
  if (z > 20.5) group = 'entry';
  else if (Math.hypot(x, z) <= 8.5) group = 'dancefloor';
  else if (Math.abs(x) <= 7.5 && z < -8) group = 'stage';
  else if (z > 12 && Math.abs(x) > 8) group = x < 0 ? 'bar' : 'lounge';
  return { tier: 0, group };
}

// Check intermediate points too: a sparse update may cut across a gated corner.
export function permittedPath(from, to, states) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / 0.2),
  );
  let previous = edmArea(from).tier;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const { tier } = edmArea({
      x: from.x + (to.x - from.x) * f,
      y: from.y + (to.y - from.y) * f,
      z: from.z + (to.z - from.z) * f,
    });
    if (tier && tier !== previous && states[tier - 1] !== 'OPEN') return false;
    previous = tier;
  }
  return true;
}
