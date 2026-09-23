import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const base = process.env.MAP_URL || "http://127.0.0.1:5173",
  seconds = Number(process.env.BENCH_SECONDS || 180);
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const output = "docs/performance";
await fs.mkdir(output, { recursive: true });
await fs.mkdir("docs/screenshots", { recursive: true });
const fingerprints = {};
for (const path of [
  "src/game/world/terrain.ts",
  "src/game/world/layers.ts",
  "src/game/world/MapScene.tsx",
  "src/game/world/player.ts",
  "src/game/world/roads.ts",
  "public/data/dongao/world.json",
  "public/data/dongao/dem/terrain.f32",
])
  fingerprints[path] = createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
const report = {
  fingerprints,
  at: new Date().toISOString(),
  environment: {
    os: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    ramGB: os.totalmem() / 2 ** 30,
    browser: browser.version(),
    mode: "development build with real cached DEM, 2789 buildings and player; headless desktop Chrome; DPR1; no device CPU throttling",
    realDevicesTested: false,
  },
  durationSeconds: seconds,
  runs: [],
};
for (const [name, width, height, mobile] of [
  ["desktop", 1440, 900, false],
  ["mobile-portrait", 390, 844, true],
  ["mobile-landscape", 844, 390, true],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(base) && !r.url().startsWith("data:"))
      external.push(r.url());
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const start = Date.now();
  await page.goto(base);
  await page.waitForFunction(() => window.__geoQA?.stats(), undefined, {
    timeout: 30000,
  });
  const readyMs = Date.now() - start;
  const initial = await page.evaluate(() => ({
    stats: window.__geoQA.stats(),
    navigation: performance.getEntriesByType("navigation")[0].toJSON(),
    resources: performance.getEntriesByType("resource").map((r) => ({
      name: r.name.replace(location.origin, ""),
      encoded: r.encodedBodySize,
      decoded: r.decodedBodySize,
      transfer: r.transferSize,
      duration: r.duration,
    })),
  }));
  await page.screenshot({
    path: `docs/screenshots/${name}-top.png`,
    fullPage: mobile,
  });
  if (name === "desktop") {
    await page.getByRole("button", { name: "切换倾斜视角" }).click();
    await page.screenshot({ path: "docs/screenshots/desktop-3d.png" });
  }
  await page.getByRole("button", { name: "跟随玩家", exact: true }).click();
  await page.evaluate(() => window.__geoQA.startRoute());
  await page.screenshot({
    path: `docs/screenshots/${name}-village.png`,
    fullPage: mobile,
  });
  const baseline = (await cdp.send("Performance.getMetrics")).metrics.find(
    (m) => m.name === "JSHeapUsedSize",
  ).value;
  const samples = [];
  let arrivalCaptured = false;
  const walkingStart = Date.now();
  while (Date.now() - walkingStart < seconds * 1000) {
    await page.waitForTimeout(5000);
    const sample = await page.evaluate(() => ({
      stats: window.__geoQA.stats(),
      player: { ...window.__geoQA.player },
      playback: { ...window.__geoQA.playback },
    }));
    const heap = (await cdp.send("Performance.getMetrics")).metrics.find(
      (m) => m.name === "JSHeapUsedSize",
    ).value;
    samples.push({
      seconds: (Date.now() - walkingStart) / 1000,
      heapMB: heap / 1048576,
      ...sample,
    });
    if (!sample.playback.active || sample.player.blocked)
      throw new Error(`Route stopped: ${JSON.stringify(sample.player)}`);
    if (!arrivalCaptured && sample.playback.laps >= 1) {
      arrivalCaptured = true;
      await page.screenshot({
        path: `docs/screenshots/${name}-beach.png`,
        fullPage: mobile,
      });
    }
    if (samples.length % 6 === 0)
      console.log(
        name,
        samples.at(-1).seconds.toFixed(1),
        "seconds",
        sample.stats.fps,
        "FPS",
        sample.player.distance.toFixed(1),
        "m",
      );
  }
  const endHeap = (await cdp.send("Performance.getMetrics")).metrics.find(
    (m) => m.name === "JSHeapUsedSize",
  ).value;
  await page.evaluate(() => window.__geoQA.stopRoute());
  await page.getByRole("button", { name: "地图回到全景" }).click();
  const toggle = page.getByRole("button", { name: "切换俯视地图" });
  if (await toggle.count()) await toggle.click();
  await page.getByRole("checkbox", { name: "卫星对照 55%" }).check();
  await page.getByRole("checkbox", { name: "参考控制点" }).check();
  await page.waitForTimeout(2200);
  const referenceStats = await page.evaluate(() => window.__geoQA.stats());
  await page.screenshot({
    path: `docs/screenshots/${name}-reference.png`,
    fullPage: mobile,
  });
  const data = {
    referenceStats,
    name,
    viewport: { width, height },
    readyMs,
    initial,
    baselineHeapMB: baseline / 1048576,
    endHeapMB: endHeap / 1048576,
    heapChangeMB: (endHeap - baseline) / 1048576,
    samples,
    errors,
    external,
    arrivalCaptured,
  };
  report.runs.push(data);
  await fs.writeFile(`${output}/${name}.json`, JSON.stringify(data, null, 2));
  await fs.writeFile(
    `${output}/full-data-benchmark.json`,
    JSON.stringify(report, null, 2),
  );
  await context.close();
  console.log(name, "complete");
}
const files = [
  "public/data/dongao/world.json",
  "public/data/dongao/dem/terrain.f32",
  "public/data/dongao/reference/sentinel-20250320.png",
];
report.payloads = await Promise.all(
  files.map(async (path) => {
    const bytes = await fs.readFile(path);
    return { path, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
  }),
);
await fs.writeFile(
  `${output}/full-data-benchmark.json`,
  JSON.stringify(report, null, 2),
);
await browser.close();
