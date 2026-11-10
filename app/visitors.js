// Background guests approach the west booths and wait in the aisle in front.
const stops = [
  [-6, 20],
  [-1, 10],
  [-3, 4],
  [-7, -4],
  [-10, -10],
  [-16.6, -10],
  [-16.6, -11.6],
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
    action = 'idle';
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

// Fixed gathering places, in metres in the reviewed EDM map. Entries are added
// one per group per round so smaller crowds still occupy different areas.
// The centre aisle, DJ ramp, stool row and sofa entrances stay clear.
const groups = [
  { y: .018, spots: [[-4.9, -4.6, -.8], [-3.2, -4.1, .4], [-4.4, -2.8, .1]] },
  { y: .018, spots: [[4.0, -3.4, .7], [5.7, -2.8, .2], [4.4, -1.5, -.4]] },
  { y: 0, spots: [[-14.8, 19.6, -.5], [-13.1, 19.5, .5]] }, // bar, beyond the stools
  { y: 0, spots: [[-8.8, 12.5, -.9], [-7.1, 13.2, .6]] }, // bar approach
  { y: 0, spots: [[10.4, 12.1, -.7], [12.1, 12.0, .2], [13.7, 12.5, .9]] }, // east open floor
  { y: 0, spots: [[5.2, 10.7, -.4], [6.0, 12.2, .8]] }, // beside the east approach
];
export const extraGuestPlaces = [0, 1, 2].flatMap(index =>
  groups.flatMap(({y, spots}, groupIndex) => {
    if (index >= spots.length) return [];
    const [x, z, yaw] = spots[index];
    // Keep each anchor fixed. Vary just the choreography within each group.
    const style = (groupIndex + index) % 3;
    return [{x, y, z, yaw, danceStyle: style,
      action: ['side-step', 'disco-point', 'groove'][(groupIndex + 2 * index) % 3]}];
  })
);
