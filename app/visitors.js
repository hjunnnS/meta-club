// The lounge sofas have multiple sections. These three AI routes end at
// the outer cushions, apart from the user-selectable centre seats.
const stops = [
  [-6, 20],
  [-1, 10],
  [3, 4],
  [7, 8],
  [8, 13],
  [9.5, 15.2],
  [9.5, 14],
];
const durations = [8, 5, 4, 4, 3, 1];
function along(path, elapsed) {
  let t = elapsed;
  for (let i = 1; i < path.length; i++) {
    const dt = durations[path === stops ? i - 1 : durations.length - i],
      a = path[i - 1],
      b = path[i];
    if (t <= dt) {
      const f = t / dt;
      return {
        x: a[0] + (b[0] - a[0]) * f,
        z: a[1] + (b[1] - a[1]) * f,
        yaw: Math.atan2(a[0] - b[0], a[1] - b[1]),
      };
    }
    t -= dt;
  }
  const last = path.at(-1);
  return { x: last[0], z: last[1], yaw: 0 };
}
const outward = [...stops].reverse();
export function background(slot, seconds) {
  const time = seconds + slot * 19,
    cycle = Math.floor(time / 78),
    phase = time % 78;
  let pose, action;
  if (phase < 13) {
    pose = along(stops, phase);
    action = 'walk';
  } else if (phase < 26) {
    pose = along(stops, 13);
    action = 'dance';
  } else if (phase < 38) {
    pose = along(stops, phase - 13);
    action = 'walk';
  } else if (phase < 53) {
    pose = along(stops, 25);
    action = 'sit';
  } else {
    pose = along(outward, phase - 53);
    action = 'walk';
  }
  return {
    id: 'ai-background-' + slot + '-' + cycle,
    ai: true,
    nickname: 'AI 손님 ' + (slot + 1),
    avatar: 'gold',
    ...pose,
    x: pose.x + slot * 0.3,
    y: 0,
    action,
  };
}
