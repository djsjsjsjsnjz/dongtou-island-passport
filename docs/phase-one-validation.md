# STEP 4 验证记录

日期：2026-09-22。本记录只覆盖 OSM 地图审阅，不代表 DEM/玩家或完整第一阶段通过验收。

## 已实际执行

- 原始项目基线：8 个进度单元测试通过，TypeScript + Vite 构建通过。
- `npm run geo:fetch`：命中已有缓存，未联网。
- `npm run geo:process`：可重复离线生成；范围 1999.95 × 1999.13 m；49 个道路要素、6 个岸线要素、1 个 building footprint、14 个土地用途/自然地表、11 个命名 POI。
- `npm run geo:check`：GIS 工具 TypeScript 通过。
- `npm test`：18 个测试通过。覆盖坐标正反转换、方向/尺度/非法坐标、bbox 上限、道路离开地图再进入不产生虚构连线、多边形洞保留、陆海不重叠且覆盖 bbox、所有岸线两侧陆左海右、全部输出坐标在范围内、建筑高度元数据优先、旧进度系统回归。
- `npm run build`：应用 TypeScript + Vite 生产构建通过。Three.js 共享包约 541 kB / gzip 138 kB，保留 >500 kB 提示，未以修改告警阈值掩盖。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：旧演示 4 项通过；新地图首次发现图层复选框焦点阻止 M 键切镜头，已修复并重新运行新地图 3 项，全部通过。
- 新地图浏览器测试包含：WebGL 非空像素、POI 村/滩南北关系、图层开关、键盘/按钮镜头切换、POI 聚焦、游标坐标、静态加载零外部请求、404 缓存提示和 WebGL 失败提示。
- 移动端测试：桌面 Chrome 模拟 390×844 触屏和 844×390 横屏；触摸平移、按钮切镜头、可滚动调试区、无横向溢出。
- 旧演示：完整任务→五章→PNG 下载→模拟兑换→刷新恢复→重置，以及水面/人物/镜头像素变化、移动触控、WebGL/存储降级通过。

- 生产预览服务已用 Codex 浏览器实际打开；地图和 POI 正常，DebugPanel 不存在，console error/warn 为空。

## 本机性能采样

1440×900 桌面 Chrome，静态地图连续 4 次 1 秒窗口：120 / 120 / 120 / 120 FPS；13 draw calls；6513 triangles；13 geometries；0 textures；JS heap 14–19 MB。[原始读数](desktop-performance.json)。

390×844 手机尺寸模拟 + 开启网格后的采样：118 FPS、14 draw calls、6513 triangles、14 geometries、JS heap 18 MB。渲染统计使用浏览器 RAF；属于本机短时结果，不是长期压力测试或实际手机测试，不能据此承诺普通手机 30 FPS。

JS heap 仅浏览器可公开提供的 JS 内存，不是 GPU 显存。隐藏页面停止 RAF，卸载释放几何体/材质/实例化资源和 controls。未做长时间内存泄漏或真实 iOS/Android/微信浏览器测试。

## 视觉证据

[桌面俯视](screenshots/dongao-desktop.png) · [倾斜视角](screenshots/dongao-oblique.png) · [手机全页](screenshots/dongao-mobile.png)。

## 验收限制

- **OSM 仅一个建筑轮廓，无法验收“村庄建筑分布真实”。** 住宅用地仅为 OSM 面状地表，未随机添加住宅。
- DEM/山体、玩家步行、真实高度贴合按用户 STEP 4 要求暂不接入。高度为明确标记的平面占位。
- 本轮自动测试证明数据转换、裁剪及显示可运行，不能证明现场道路/岸线已经完全符合现实；需要用户对照现实地图/实景完成空间方向确认。
- 尚未推送 GitHub、发布 Pages 或部署线上版本。
