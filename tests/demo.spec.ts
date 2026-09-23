import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs/promises';

async function visit(page: Page, name: string) {
  const close = page.getByRole('button', { name: '关闭面板', exact: true });
  if (await close.isVisible()) await close.click();
  const toggle = page.getByRole('button', { name: '海岛目的地', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('button', { name: `探索${name}`, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function pixels(page: Page) {
  const data = await page.locator('.scene canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
  return PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'));
}
function changed(a: PNG, b: PNG, filter: (r: number, g: number, b: number, x: number, y: number) => boolean) {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (filter(a.data[i], a.data[i + 1], a.data[i + 2], i / 4 % a.width, Math.floor(i / 4 / a.width)) && Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 9) n++;
  return n;
}

test('complete visitor journey, persistence, download, redeem and reset', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=legacy');
  await expect(page.locator('.scene canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-map.png') });
  await page.getByRole('button', { name: '海岛奖励', exact: true }).click();
  await expect(page.getByText('集齐五枚印章，成为“洞头岛民”。')).toBeVisible();
  await visit(page, '东岙广场');
  const lantern = page.getByRole('button', { name: '点亮平安渔灯' });
  await lantern.click(); await lantern.click();
  await expect(page.locator('.task-meta')).toContainText('1 / 3');
  await page.getByRole('button', { name: '关闭面板' }).click();
  await page.reload(); await visit(page, '东岙广场');
  await expect(lantern).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('desktop-task.png') });
  await page.getByRole('button', { name: '点亮顺遂渔灯' }).click();
  await page.getByRole('button', { name: '点亮团圆渔灯' }).click();
  await expect(page.getByRole('heading', { name: '渔灯章，已收藏' })).toBeVisible();
  await visit(page, '东岙广场');
  await expect(page.getByRole('button', { name: '旅行护照，已集齐1枚印章' })).toBeVisible();
  await visit(page, '七夕古巷');
  await page.getByRole('button', { name: 'A 做十二' }).click();
  await expect(page.getByRole('alert')).toContainText('再想一想');
  await page.getByRole('button', { name: 'B 做十六' }).click();
  await visit(page, '东岙沙滩');
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `收集第${i}枚贝壳` }).click();
  await visit(page, '海风民宿');
  await page.getByLabel('民宿打卡口令').fill('错误');
  await page.getByRole('button', { name: '打卡', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('口令不对');
  await page.getByLabel('民宿打卡口令').fill('海风');
  await page.getByRole('button', { name: '打卡', exact: true }).click();
  await visit(page, '渔家小馆');
  const choose = page.getByRole('button', { name: '选入我的旅行餐单' });
  await expect(choose).toBeDisabled();
  for (const name of ['清蒸海鱼', '紫菜虾皮汤', '海苔饭团']) await page.getByRole('button', { name: new RegExp(name) }).click();
  await choose.click();
  await expect(page.getByRole('button', { name: '旅行护照，已集齐5枚印章' })).toBeVisible();
  await page.getByRole('button', { name: '旅行护照', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('desktop-passport.png') });
  await page.getByRole('button', { name: '领取洞头岛民纪念卡' }).click();
  await page.getByLabel('纪念卡上的名字').fill('海风旅人小陈');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载旅行纪念卡' }).click();
  const download = await downloadEvent;
  const path = testInfo.outputPath('souvenir.png'); await download.saveAs(path);
  const card = PNG.sync.read(await fs.readFile(path));
  expect([card.width, card.height]).toEqual([1080, 1440]);
  expect(card.data.some(value => value !== 255)).toBe(true);
  await page.getByRole('button', { name: '模拟核销一次' }).click();
  await expect(page.getByRole('button', { name: '已模拟核销' })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: '海岛奖励', exact: true }).click();
  await expect(page.getByLabel('纪念卡上的名字')).toHaveValue('海风旅人小陈');
  await expect(page.getByRole('button', { name: '已模拟核销' })).toBeDisabled();
  await page.getByRole('button', { name: '关闭面板' }).click();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '保留旅程' }).click();
  await expect(page.getByRole('button', { name: '旅行护照，已集齐5枚印章' })).toBeVisible();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '重新开始' }).click();
  await expect(page.getByRole('button', { name: '旅行护照，已集齐0枚印章' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '旅行护照，已集齐0枚印章' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('WebGL pixels, water, walking and camera control', async ({ page }, testInfo) => {
  await page.goto('/?demo=legacy'); await expect(page.locator('#pin-plaza')).toHaveCSS('visibility', 'visible');
  const a = await pixels(page);
  const colors = new Set(); for (let i = 0; i < a.data.length; i += 160) colors.add(`${a.data[i]},${a.data[i + 1]},${a.data[i + 2]}`);
  expect(colors.size).toBeGreaterThan(100);
  await page.waitForTimeout(700); const b = await pixels(page);
  const waterChanges = changed(a, b, (_, __, ___, x) => x > a.width * 0.8);
  expect(waterChanges).toBeGreaterThan(500);
  await page.getByRole('button', { name: '探索海风民宿', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '正沿海岸' })).toBeVisible();
  const beforeWalk = await pixels(page); await page.waitForTimeout(500); const afterWalk = await pixels(page);
  const landChanges = changed(beforeWalk, afterWalk, (r, g, b) => r > b * 1.25 && g > b * 1.15);
  expect(landChanges).toBeGreaterThan(20);
  await expect(page.getByRole('heading', { name: '海风民宿', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭面板' }).click();
  const pinBefore = await page.locator('#pin-inn').boundingBox();
  await page.getByRole('button', { name: '放大地图' }).click();
  await expect.poll(async () => (await page.locator('#pin-inn').boundingBox())!.x).not.toBe(pinBefore!.x);
  const zoomed = await pixels(page);
  await page.mouse.move(930, 650); await page.mouse.down(); await page.mouse.move(1120, 600, { steps: 12 }); await page.mouse.up();
  const rotated = await pixels(page);
  expect(changed(zoomed, rotated, () => true)).toBeGreaterThan(5000);
  await page.getByRole('button', { name: '回到全景' }).click();
  await page.screenshot({ path: testInfo.outputPath('desktop-scene.png') });
  await fs.writeFile(testInfo.outputPath('canvas-checks.json'), JSON.stringify({ colors: colors.size, waterChanges, landChanges }, null, 2));
});

test('portrait and landscape touch, drawer layout and reduced motion', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:5173/?demo=legacy');
  await expect(page.locator('#pin-plaza')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-map.png') });
  const a = await pixels(page); await page.waitForTimeout(200); const b = await pixels(page);
  expect(changed(a, b, () => true)).toBe(0);
  await page.getByRole('button', { name: '前往东岙广场', exact: true }).tap();
  await page.getByRole('button', { name: '点亮平安渔灯' }).tap();
  await page.screenshot({ path: testInfo.outputPath('mobile-task.png') });
  const panel = await page.locator('.detail-panel').boundingBox(), nav = await page.locator('.bottom-nav').boundingBox();
  expect(panel!.y + panel!.height).toBeLessThan(nav!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '关闭面板' }).tap();
  const before = await page.locator('#pin-inn').boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 130, y: 540 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 130 + i * 15, y: 540 - i * 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await page.locator('#pin-inn').boundingBox())!.x).not.toBe(before!.x);
  await page.getByRole('button', { name: '回到全景' }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: testInfo.outputPath('landscape-map.png') });
  await visit(page, '七夕古巷');
  await page.getByRole('button', { name: 'B 做十六' }).tap();
  await expect(page.getByRole('heading', { name: '七夕章，已收藏' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('landscape-task.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const landscapeNav = await page.locator('.bottom-nav').boundingBox();
  const landscapePanel = await page.locator('.detail-panel').boundingBox();
  expect(landscapeNav!.y + landscapeNav!.height).toBeLessThanOrEqual(390);
  expect(landscapePanel!.y + landscapePanel!.height).toBeLessThan(landscapeNav!.y);
  await context.close();
});

test('storage denied and WebGL unavailable still allow tasks', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Denied', 'SecurityError'); };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto('/?demo=legacy');
  await expect(page.getByText('海岛故事，继续出发')).toBeVisible();
  await expect(page.locator('.storage-warning')).toContainText('仍可体验');
  await visit(page, '东岙广场');
  for (const label of ['平安', '顺遂', '团圆']) await page.getByRole('button', { name: `点亮${label}渔灯` }).click();
  await expect(page.getByRole('button', { name: '旅行护照，已集齐1枚印章' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('fallback-task.png') });
});
