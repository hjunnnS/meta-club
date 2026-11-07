import { Client as Colyseus } from "colyseus.js";
import { Client as Nakama } from "@heroiclabs/nakama-js";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();
const p95 = (a) =>
  a.length
    ? a.slice().sort((x, y) => x - y)[Math.ceil(a.length * 0.95) - 1]
    : null;
const decode = new TextDecoder();
function snapshot(subscribe, send) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("snapshot timeout")), 4000);
    subscribe((value) => {
      clearTimeout(timer);
      resolve(value);
    });
    send();
  });
}
async function connect(kind, id, key, onState) {
  if (kind === "colyseus") {
    const client = new Colyseus("ws://127.0.0.1:17351");
    const room = id
      ? await client.joinById(id, { key })
      : await client.create("g0", { key });
    room.onMessage("state", onState);
    let handler;
    room.onMessage("snapshot", (value) => handler?.(value));
    return {
      id: room.roomId,
      send: (m) => room.send("input", m),
      drop: () => room.connection.close(),
      snapshot: () =>
        snapshot(
          (fn) => (handler = fn),
          () => room.send("restore"),
        ),
    };
  }
  const client = new Nakama("defaultkey", "127.0.0.1", "17350", false);
  const session = await client.authenticateDevice(key, true);
  const socket = client.createSocket(false, false);
  await socket.connect(session);
  try {
    if (!id) id = (await client.rpc(session, "g0_create", {})).payload.id;
    let handler;
    socket.onmatchdata = (event) => {
      const data = JSON.parse(decode.decode(event.data));
      if (event.op_code === 2) handler?.(data);
      else onState(data);
    };
    await socket.joinMatch(id);
    return {
      id,
      send: (m) => socket.sendMatchState(id, 1, JSON.stringify(m)),
      drop: () => socket.disconnect(false),
      snapshot: () =>
        snapshot(
          (fn) => (handler = fn),
          () => socket.sendMatchState(id, 2, "{}"),
        ),
    };
  } catch (e) {
    socket.disconnect(false);
    throw e;
  }
}
window.runNetwork = async function (kind, route) {
  const prefix = "g0-" + crypto.randomUUID() + "-",
    clients = [];
  const latencies = [],
    tick = [],
    recovery = [],
    snapshotCounts = [],
    finalSeq = new Map();
  let bytes = 0,
    batches = 0,
    overs = 0;
  const observe = (data) => {
    bytes += new TextEncoder().encode(JSON.stringify(data)).length;
    batches++;
    if (data.count > 60) overs++;
    tick.push(data.previousMs);
    requestAnimationFrame(() => {
      document.querySelector("output").textContent = JSON.stringify(
        data.changes.at(-1),
      );
      for (const change of data.changes) {
        finalSeq.set(change.actor, change.seq);
        if (change.actor !== 0) latencies.push(now() - change.sent);
      }
    });
  };
  const noop = () => {};
  let id;
  const enter = (actor, handler = noop) =>
    connect(kind, id, prefix + actor, handler);
  const first = await enter(0, observe);
  id = first.id;
  clients.push(first);
  const duplicate = await enter(0).then(
    (c) => {
      c.drop();
      return "accepted";
    },
    () => "rejected",
  );
  for (let i = 1; i < 59; i++) clients.push(await enter(i));
  const race = await Promise.allSettled([enter(59), enter(60)]);
  const accepted = race.filter((r) => r.status === "fulfilled");
  if (accepted.length !== 1)
    throw Error("last-seat race admitted " + accepted.length);
  clients.push(accepted[0].value);
  const start = now();
  for (let seq = 0; seq < 40; seq++) {
    for (let actor = 0; actor < 60; actor++) {
      const [x, y, z] = route[(seq + actor) % route.length];
      clients[actor].send({
        actor,
        seq,
        x,
        y,
        z,
        dance: seq % 4 === 0,
        sent: now(),
      });
    }
    await sleep(150);
  }
  await sleep(650);
  const duration = (now() - start) / 1000;
  // Use a retained, non-racing identity with known terminal state.
  for (let i = 0; i < 10; i++) {
    const index = 1,
      start = now();
    clients[index].drop();
    let restored = false;
    while (now() - start < 5000) {
      try {
        const c = await enter(index);
        clients[index] = c;
        const snap = await c.snapshot();
        snapshotCounts.push(snap.count);
        restored =
          snap.last?.actor === 1 && snap.last?.seq === 39 && snap.count === 60;
        if (!restored) throw Error("state mismatch");
        break;
      } catch {
        await sleep(100);
      }
    }
    recovery.push({ ms: Math.round(now() - start), restored });
  }
  clients.forEach((c) => c.drop());
  await sleep(3000);
  let oldGone = false;
  try {
    const unexpected = await enter(1);
    unexpected.drop();
  } catch {
    oldGone = true;
  }
  id = undefined;
  const safe = await enter(1);
  const clean = await safe.snapshot();
  safe.drop();
  return {
    kind,
    users: 60,
    sentInputs: 2400,
    duplicate,
    lastSeatAccepted: accepted.length,
    observerBatches: batches,
    receivedRemoteInputs: latencies.length,
    finalActorCount: finalSeq.size,
    actorsWithFinalSequence: [...finalSeq.values()].filter((n) => n === 39)
      .length,
    overCapacityBatches: overs,
    restoredCounts: snapshotCounts,
    handlerPreviousActiveMsP95: p95(tick),
    observerFrameCallbackMsP95: p95(latencies),
    observerJsonBytes: bytes,
    observerJsonKiBps: bytes / duration / 1024,
    recovery,
    recoveryP95: p95(recovery.map((r) => r.ms)),
    missingChannelRejected: oldGone,
    safeChannelFresh: clean.last === null && clean.count === 1,
  };
};
