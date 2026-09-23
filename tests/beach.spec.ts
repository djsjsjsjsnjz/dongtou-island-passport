import { expect, test } from "@playwright/test";

test("independent beach slice loads aligned data, views and player without external requests", async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:5173"))
      external.push(request.url());
  });
  await page.goto("/beach/");
  await expect(page.locator(".beach-canvas canvas")).toBeVisible();
  await expect(page.getByTestId("beach-stats")).toContainText("triangles");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator('[data-poi="way/836480414"]')).toBeVisible();
  const manifest = await page.evaluate(() => (window as any).__beachQA.manifest);
  expect(manifest.sourceSnapshotCommit).toBe("a7168d8");
  expect(manifest.counts.output.buildings).toBe(376);
  expect(manifest.counts.output.roads).toBe(4);
  expect(manifest.dem.outputWidth).toBe(26);
  expect(manifest.dem.outputHeight).toBe(23);
  const player = await page.evaluate(() => ({ ...(window as any).__beachQA.player }));
  expect(player.longitude).toBeCloseTo(121.15639, 6);
  expect(player.latitude).toBeCloseTo(27.8246, 6);
  expect(player.blocked).toBe("");
  for (const name of ["View A", "View B", "View C", "俯视全景"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("checkbox", { name: "建筑 footprint" }).uncheck();
  await page.getByRole("checkbox", { name: "建筑 footprint" }).check();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("beach slice missing data fails clearly and Debug Map remains available", async ({
  page,
}) => {
  await page.route("**/data/dongao-beach/world.json", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/beach/");
  await expect(page.getByRole("alert")).toContainText("沙滩切片读取失败");
  await page.unroute("**/data/dongao-beach/world.json");
  await page.goto("/debug/map/");
  await expect(page.locator(".geo-canvas canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "东岙 · 真实地图骨架" })).toBeVisible();
});
