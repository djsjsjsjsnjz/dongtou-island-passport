import { test, expect } from "@playwright/test";
test("real DSM, keyboard and touch player movement, satellite overlay and nodata failure", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("geo-stats")).toContainText("draw calls");
  const start = await page.evaluate(() => ({
    ...(window as any).__geoQA.player,
  }));
  await page.getByRole("button", { name: "跟随玩家", exact: true }).click();
  await page.keyboard.down("s");
  await page.waitForTimeout(1300);
  await page.keyboard.up("s");
  await expect
    .poll(() => page.evaluate(() => (window as any).__geoQA.player.distance))
    .toBeGreaterThan(2);
  const after = await page.evaluate(() => (window as any).__geoQA.player);
  expect(after.z).toBeGreaterThan(start.z);
  expect(after.y).toBeGreaterThan(0);
  expect(after.blocked).toBe("");
  await page.getByRole("button", { name: "切换俯视地图" }).click();
  await page.getByRole("button", { name: "地图回到全景" }).click();
  await page.getByRole("checkbox", { name: "卫星对照 55%" }).check();
  await expect
    .poll(() => page.evaluate(() => (window as any).__geoQA.stats().textures))
    .toBeGreaterThan(0);
  await page.getByRole("checkbox", { name: "参考控制点" }).check();
  await page.screenshot({ path: "docs/screenshots/geography-reference.png" });
  await page.route("**/data/dongao/world.json", async (r) => {
    const response = await r.fetch();
    const data = await response.json();
    delete data.dem;
    await r.fulfill({ json: data });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("DEM 数据缺失");
});
test("mobile touch moves player and pointer cancellation releases controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await expect(page.getByTestId("geo-stats")).toContainText("draw calls");
  const cdp = await context.newCDPSession(page);
  const b = await page.getByRole("button", { name: "向南移动" }).boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 }],
  });
  await page.waitForTimeout(1200);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  const distance = await page.evaluate(
    () => (window as any).__geoQA.player.distance,
  );
  expect(distance).toBeGreaterThan(2);
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => (window as any).__geoQA.player.distance),
  ).toBeCloseTo(distance, 3);
  await context.close();
});

test("real-time village to beach walk reaches arrival with live collision and saves evidence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("geo-stats")).toContainText("draw calls");
  await page.getByRole("button", { name: "跟随玩家", exact: true }).click();
  const started = Date.now();
  await page.evaluate(() => (window as any).__geoQA.startRoute());
  await page.screenshot({ path: "docs/screenshots/player-village-start.png" });
  await page.waitForFunction(
    () => (window as any).__geoQA.playback.laps >= 1,
    undefined,
    { timeout: 75000 },
  );
  const arrival = await page.evaluate(() => {
    const q = (window as any).__geoQA;
    q.stopRoute();
    return { ...q.player };
  });
  expect(arrival.blocked).toBe("");
  expect(arrival.longitude).toBeCloseTo(121.15639, 5);
  expect(arrival.latitude).toBeCloseTo(27.8246, 5);
  expect(arrival.distance).toBeGreaterThan(140);
  expect(arrival.distance).toBeLessThan(150);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: "docs/screenshots/player-beach-arrival.png" });
  const fs = await import("node:fs/promises");
  await fs.mkdir("docs/performance", { recursive: true });
  await fs.writeFile(
    "docs/performance/route-verification.json",
    JSON.stringify(
      {
        elapsedMs: Date.now() - started,
        arrival,
        method:
          "Actual RAF movement at 3.2m/s, no teleport; follows OSM way then 21m unmapped approach",
      },
      null,
      2,
    ),
  );
});

test("missing or corrupt DEM mesh fails closed", async ({ page }) => {
  await page.route("**/data/dongao/dem/terrain.f32", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("网格缓存读取失败");
  await page.unroute("**/data/dongao/dem/terrain.f32");
  await page.route("**/data/dongao/dem/terrain.f32", (r) =>
    r.fulfill({ status: 200, body: Buffer.alloc(36) }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("网格缓存损坏");
});
