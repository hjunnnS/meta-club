// Local benchmark only. The database is disposable.
function createRoom(ctx, logger, nk) {
  return JSON.stringify({ id: nk.matchCreate("g0", {}) });
}
function roomInit() {
  return {
    state: { slots: {}, last: {}, empty: 0, previousMs: 0 },
    tickRate: 20,
    label: "g0",
  };
}
function joinAttempt(ctx, log, nk, d, t, s, p) {
  var ok = !s.slots[p.userId] && Object.keys(s.slots).length < 60;
  if (ok) s.slots[p.userId] = p.sessionId;
  return { state: s, accept: ok, rejectMessage: "occupied" };
}
function join(ctx, log, nk, d, t, s) {
  return { state: s };
}
function leave(ctx, log, nk, d, t, s, ps) {
  ps.forEach(function (p) {
    if (s.slots[p.userId] === p.sessionId) delete s.slots[p.userId];
  });
  return { state: s };
}
function loop(ctx, log, nk, d, t, s, msgs) {
  var start = Date.now(),
    changes = [],
    count = Object.keys(s.slots).length;
  s.empty = count ? 0 : s.empty + 1;
  if (s.empty > 40) return null;
  msgs.forEach(function (m) {
    if (m.opCode === 2) {
      d.broadcastMessage(
        2,
        JSON.stringify({ last: s.last[m.sender.userId] || null, count: count }),
        [m.sender],
      );
    } else {
      var x = JSON.parse(nk.binaryToString(m.data));
      changes.push(x);
      s.last[m.sender.userId] = x;
    }
  });
  if (changes.length) {
    d.broadcastMessage(
      1,
      JSON.stringify({
        changes: changes,
        count: count,
        previousMs: s.previousMs,
      }),
    );
    s.previousMs = Date.now() - start;
  }
  return { state: s };
}
function terminate(ctx, log, nk, d, t, s) {
  return { state: s };
}
function signal(ctx, log, nk, d, t, s) {
  return { state: s, data: "" };
}
function InitModule(ctx, log, nk, init) {
  init.registerRpc("g0_create", createRoom);
  init.registerMatch("g0", {
    matchInit: roomInit,
    matchJoinAttempt: joinAttempt,
    matchJoin: join,
    matchLeave: leave,
    matchLoop: loop,
    matchTerminate: terminate,
    matchSignal: signal,
  });
}
