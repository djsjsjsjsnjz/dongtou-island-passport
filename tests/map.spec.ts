import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import fs from "node:fs/promises";

test("real map: cached data, aligned labels, layer switches, camera, coordinates and performance", async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator(".geo-canvas canvas")).toBeVisible();
  await expect(page.getByTestId("geo-stats")).toContainText("draw calls");
  await expect(page.getByRole("alert")).toHaveCount(0);
  const village = page.locator('[data-poi="node/13607433057"]'),
    beach = page.locator('[data-poi="way/836480414"]');
  const v = await village.boundingBox(),
    b = await beach.boundingBox();
  expect(v!.y).toBeLessThan(b!.y);
  const shot = await page.locator(".geo-canvas canvas").screenshot();
  const png = PNG.sync.read(shot);
  const colors = new Set();
  for (let i = 0; i < png.data.length; i += 128)
    colors.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
  expect(colors.size).toBeGreaterThan(15);
  await page.screenshot({ path: testInfo.outputPath("dongao-desktop.png") });
  await page.getByRole("checkbox", { name: "POI", exact: true }).uncheck();
  await expect(village).toBeHidden();
  await page.getByRole("checkbox", { name: "POI", exact: true }).check();
  await expect(village).toBeVisible();
  const statsBefore = await page.getByTestId("geo-stats").innerText();
  await page.getByRole("checkbox", { name: "道路", exact: true }).uncheck();
  await expect
    .poll(() => page.getByTestId("geo-stats").innerText())
    .not.toBe(statsBefore);
  await page.getByRole("checkbox", { name: "道路", exact: true }).check();
  await page.keyboard.press("m");
  await expect(
    page.getByRole("button", { name: "切换俯视地图" }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dongao-oblique.png") });
  await page.mouse.move(450, 450);
  await page.mouse.down();
  await page.mouse.move(650, 420, {steps: 8});
  await page.mouse.up();
  await page.keyboard.press("m");
  await page.getByRole("button", { name: /东岙沙滩.*121/ }).click();
  await expect.poll(async () => (await beach.boundingBox())!.x).not.toBe(b!.x);
  await page.getByRole("button", { name: "地图回到全景" }).click();
  await page.mouse.move(480, 400);
  await expect(page.getByTestId("world-coordinate")).not.toHaveText(
    "0.0 / 0.0 m",
  );
  const readings: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1050);
    readings.push(await page.getByTestId("geo-stats").innerText());
  }
  await fs.writeFile(
    testInfo.outputPath("desktop-performance.json"),
    JSON.stringify(
      { readings, colors: colors.size, external, errors },
      null,
      2,
    ),
  );
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("mobile portrait and landscape: touch panning, controls, scrollable debug", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/");
  await expect(page.locator(".geo-canvas canvas")).toBeVisible();
  await expect(page.getByTestId("geo-stats")).toContainText("draw calls");
  await page.screenshot({
    path: testInfo.outputPath("dongao-mobile.png"),
    fullPage: true,
  });
  const beach = page.locator('[data-poi="way/836480414"]'),
    before = await beach.boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 140, y: 310 }],
  });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 140 + i * 10, y: 310 + i * 3 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => (await beach.boundingBox())!.x)
    .not.toBe(before!.x);
  await page.getByRole("button", { name: "地图回到全景" }).tap();
  await page.getByRole("button", { name: "切换倾斜视角" }).tap();
  await expect(
    page.getByRole("button", { name: "切换俯视地图" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "100 m 坐标网格" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("checkbox", { name: "100 m 坐标网格" }).check();
  await page.waitForTimeout(1200);
  await fs.writeFile(
    testInfo.outputPath("mobile-emulated-performance.txt"),
    await page.getByTestId("geo-stats").innerText(),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page
    .getByRole("heading", { name: "东岙 · 真实地图骨架" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("dongao-landscape.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test("missing cache and WebGL failure show explicit recoverable errors", async ({
  page,
}) => {
  await page.route("**/data/dongao/world.json", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("地图缓存读取失败");
  await page.unroute("**/data/dongao/world.json");
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("地图暂不可显示");
  await expect(page.getByRole("button", { name: /东岙村.*121/ })).toBeVisible();
});
