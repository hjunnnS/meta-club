// The test server and browser run on the same host; wall time provides an independent reference.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const context = document.querySelector("audio");
const local = () => Date.now() + 1250;
async function prepare() {
  context.src = URL.createObjectURL(await (await fetch("/tone.wav")).blob());
  context.loop = true;
  context.load();
  await new Promise((ok, no) => {
    context.onloadedmetadata = ok;
    context.onerror = no;
  });
  let blocked = false;
  try {
    await context.play();
    context.pause();
  } catch (e) {
    blocked = e.name === "NotAllowedError";
  }
  return blocked;
}
const prepared = prepare().then((blocked) => {
  document.body.dataset.audioPrepared = "true";
  return blocked;
});
window.probeMusic = async (method, delay) => {
  const blocked = await prepared;
  const button = document.querySelector("button");
  await new Promise((resolve, reject) => {
    button.onclick = () => context.play().then(resolve, reject);
    button.disabled = false;
  });
  const measurements = [];
  async function sync(event) {
    const start = performance.now(),
      sent = local();
    const q = await (
      await fetch("/clock?delay=" + delay, { cache: "no-store" })
    ).json();
    const received = local();
    const serverMinusLocal = q.sample - (sent + received) / 2;
    const atReceive =
      method === "position"
        ? q.position
        : received + serverMinusLocal - q.epoch;
    const sought = new Promise((ok, no) => {
      context.addEventListener("seeked", ok, { once: true });
      setTimeout(() => no(Error("seek timeout")), 3000);
    });
    context.currentTime = (((atReceive % 12000) + 12000) % 12000) / 1000;
    await sought;
    await context.play();
    await wait(2900 - (performance.now() - start));
    const expected = (((Date.now() - q.epoch) % 12000) + 12000) % 12000;
    const diff = Math.abs(context.currentTime * 1000 - expected);
    measurements.push({
      event,
      msSinceRequest: Math.round(performance.now() - start),
      playing: !context.paused,
      expectedMs: Math.round(expected),
      actualMs: Math.round(context.currentTime * 1000),
      errorMs: Math.round(Math.min(diff, 12000 - diff)),
      roundTripMs: received - sent,
    });
  }
  await sync("late-entry");
  context.pause();
  await wait(650);
  await sync("resume");
  context.pause();
  return { method, delay, blocked, measurements };
};
