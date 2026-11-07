const { chromium } = require("playwright-core");
const { build } = require("esbuild");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const output = path.resolve("results"),
  epoch = Date.now() - 4200;
const glb = fs.readFileSync("../stage/edm-empty.glb");
const route = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12))).extras
  .reviewRoute;
function tone() {
  const rate = 11025,
    samples = rate * 12,
    data = Buffer.alloc(44 + 2 * samples);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    data.writeInt16LE(
      Math.round(900 * Math.sin((2 * Math.PI * 220 * i) / rate)),
      44 + i * 2,
    );
  return data;
}
(async () => {
  const bundle = (
    await build({
      entryPoints: ["network.js"],
      bundle: true,
      write: false,
      platform: "browser",
    })
  ).outputFiles[0].contents;
  const audio = tone();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname === "/clock") {
      const half = Number(u.searchParams.get("delay")) / 2;
      setTimeout(() => {
        const sample = Date.now();
        const data = JSON.stringify({
          sample,
          epoch,
          position: (sample - epoch) % 12000,
        });
        setTimeout(() => {
          res.writeHead(200, { "Cache-Control": "no-store" });
          res.end(data);
        }, half);
      }, half);
      return;
    }
    if (u.pathname === "/tone.wav") {
      res.writeHead(200, {
        "Content-Type": "audio/wav",
        "Content-Length": audio.length,
      });
      res.end(audio);
      return;
    }
    if (u.pathname === "/network.js" || u.pathname === "/music.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(
        u.pathname === "/music.js" ? fs.readFileSync("music.js") : bundle,
      );
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      "<meta charset=utf-8><button disabled>재생</button><audio></audio><output></output><script src=/network.js></script><script src=/music.js></script>",
    );
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    ignoreDefaultArgs: ["--autoplay-policy=no-user-gesture-required"],
    args: ["--autoplay-policy=user-gesture-required"],
  });
  try {
    const target = "http://127.0.0.1:" + server.address().port;
    const tasks = process.argv.slice(2);
    for (const kind of tasks) {
      let result;
      if (kind === "music") {
        result = [];
        for (let repeat = 0; repeat < 3; repeat++)
          for (const method of repeat % 2
            ? ["timestamp", "position"]
            : ["position", "timestamp"])
            for (const delay of [0, 150]) {
              const fresh = await browser.newPage();
              await fresh.goto(target);
              await fresh.waitForSelector("body[data-audio-prepared=true]");
              const capture = fresh.evaluate(
                ([m, d]) => probeMusic(m, d),
                [method, delay],
              );
              await fresh.getByRole("button").click();
              result.push({ repeat: repeat + 1, ...(await capture) });
              await fresh.close();
            }
      } else {
        const page = await browser.newPage();
        try {
          await page.goto(target);
          result = await page.evaluate(
            ([kind, route]) => runNetwork(kind, route),
            [kind, route],
          );
        } finally {
          await page.close();
        }
      }
      const record = {
        browser: browser.version(),
        map: "d5aa590",
        run: new Date().toISOString(),
        result,
      };
      const file = path.join(
        output,
        kind + (process.env.RUN_SUFFIX || "") + ".json",
      );
      fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
      console.log(file, JSON.stringify(result));
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
