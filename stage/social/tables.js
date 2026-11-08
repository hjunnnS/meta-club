// Fit one two-person table between the nearest pair of reviewed seat anchors on each deck.
export function socialTables({ seatCandidates }) {
  return Object.entries(seatCandidates).map(([id, points]) => {
    let pair,
      shortest = Infinity;
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i][0] - points[j][0], points[i][2] - points[j][2]);
        if (d < shortest - 0.001) {
          shortest = d;
          pair = [points[i], points[j]];
        }
      }
    const center = pair[0].map((n, i) => (n + pair[1][i]) / 2);
    return {
      id,
      center,
      seats: pair.map(([x, y, z], i) => ({
        id: id + '-' + i,
        table: id,
        x,
        y,
        z,
        yaw: Math.atan2(center[0] - x, center[2] - z),
      })),
    };
  });
}
