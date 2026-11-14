// Background guests approach the current east booths and wait in the aisle in front.
const stops = [
  [-3, 18.5],
  [-1, 10],
  [3, 4],
  [7, -4],
  [10, -7],
  [16.0, -7],
  [16.0, -9],
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
  { y: .018, spots: [[-4.8, -10.0, -.35], [-6.3, -7.0, .30], [-3.8, -5.2, -.15]] },
  { y: .018, spots: [[4.8, -9.3, .35], [6.0, -6.1, -.25], [4.2, -3.5, .15]] },
  { y: 0, spots: [[-13.4, -7.1, -.75], [-13.4, .1, -.40]] }, // beside the podiums, not on their slots
  { y: 0, spots: [[-16.8, 12.4, -.5], [-14.0, 11.9, .5]] }, // open area in front of the bar
  { y: 0, spots: [[19.0, 6.4, -Math.PI/2], [19.0, -6.8, -Math.PI/2]] }, // gaps between booth groups, clear of seat exits
  { y: 4.02, action: 'groove', spots: [[-17.75, -11.65, Math.PI/2], [17.75, -11.65, -Math.PI/2], [0, 18.5, Math.PI]],
    fallbacks: [[-7.3, -11.6], [7.3, -11.6], [7.1, .4]] }, // viewing pockets, clear of stairs, sofas and the U-shaped route
];
export const extraGuestPlaces = [0, 1, 2].flatMap(index =>
  groups.flatMap(({y, spots, action, fallbacks}, groupIndex) => {
    if (index >= spots.length) return [];
    const [x, z, yaw] = spots[index];
    // Keep each anchor fixed. Vary just the choreography within each group.
    const style = (groupIndex + index) % 3;
    return [{x, y, z, yaw, danceStyle: style,
      action: action || ['side-step', 'disco-point', 'groove'][(groupIndex + 2 * index) % 3],
      ...(fallbacks?{fallback:{x:fallbacks[index][0],y:.018,z:fallbacks[index][1],yaw,action:'groove'}}:{})}];
  })
);
