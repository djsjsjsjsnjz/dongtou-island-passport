# 东岙 · Spatial Prototype 与沙滩场景切片

React + TypeScript + Vite + Three.js。当前已接入真实 Copernicus DSM、公开建筑轮廓、沿实际道路移动的轻量玩家，以及地理 QA 工具。**尚未通过完整地理验收，不能进入 NPC、任务、鱼灯剧情或地标美术阶段。**主要缺口为高德/现场独立配准、建筑逐栋核验、内陆道路水体冲突和桥隧纵断面。

[沙滩 Step 1 验收](docs/beach-step1-validation.md) · [冻结版交付索引](docs/DELIVERY.md) · [地理质量报告](docs/geography-validation.md) · [数据与许可](docs/data-sources.md) · [性能报告](docs/performance-report.md)

当前约 2×2km Spatial Prototype 已冻结在 commit `a7168d8`，只作为 Debug Map / GIS 校准底座。新的产品方向是东岙沙滩小场景；目前只完成 Step 1 数据裁切和独立入口，尚未进入环境美术。

## 运行

Node.js 20.19+ / 22.12+：

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

所有运行数据随项目缓存，不需要 key。网页不调用临时外部接口。打开 Vite 显示的地址（通常 5173；占用时顺延）。

- Beach Game Scene：`/beach/`，也可使用 `/?scene=beach`。
- 冻结 Debug Map：`/debug/map/`；根路径 `/` 保持进入 Debug Map。
- 重新生成沙滩切片：`npm run geo:beach`。该命令只写入 `public/data/dongao-beach/`，不会修改 `public/data/dongao/`。

- 默认正北俯视；拖动平移、滚轮/双指缩放，M 切换倾斜视角，全景回到 bbox。
- 点击“跟随玩家”，用 WASD / 方向键或触控方向键行走。方向键固定东南西北，与镜头旋转无关。
- 出生 WGS84：`[121.15599415965787,27.825667736962423]`，位于东岙村代表点西侧约 76m 的真实道路上。
- 沿 OSM `way/1546274171` 南行，转向沙滩面内到达点 `[121.15639,27.82460]`。约 145m，其中最后约 21m 没有已测步道或真实入口证据。
- 最大可行走坡度 35°；玩家扫掠碰撞建筑，阻挡海域、水体、边界、缺失高程及未建纵断面的隧道。
- 开发模式提供海岸/道路/建筑/DEM/POI/100m 网格开关、高程着色、道路类型/异常、卫星半透明对照和控制点误差连线。网格在地形上方，比例尺只在正北俯视显示。
- 原始 DSM 与实际渲染地形高度分别显示，倍率固定 1×。生产包不暴露 DebugPanel、卫星 QA 纹理或 `__geoQA` 测试接口。
- 原概念演示仅保留于 `?demo=legacy`，本轮没有增加其中的玩法。

## 本轮可验证差异

| 项目 | 上一版 | 当前 |
| --- | --- | --- |
| 地形 | 零高程平面 | 77×69 原始 DSM 样本，61,992 个陆地地形三角面，0–114.238m |
| 建筑 | 1 栋 | 2,789 栋可追溯 footprint（含去重）；非测量高度统一暂定 6m |
| 道路 | 平面带状几何 | 原平面拓扑不变，普通道路面按真实地形三角面裁剪；桥隧分离 |
| 玩家 | 无 | 键盘、触控、跟随镜头、地形/坡度/建筑/海域约束 |
| 参考 | 仅 OSM 自洽 | 同 bbox 的公开 Sentinel-2 独立粗配准与控制点；高德仍缺失 |
| 性能 | 0 DEM / 1 建筑 | 完整数据下三种尺寸连续移动，各 3 分钟，原始采样可查看 |

空间唯一基准：WGS84，GeoJSON `[longitude,latitude]`，米制 +X 东 / -Z 北 / +Y 上。bbox `[121.14685,27.81648,121.16715,27.83452]`，原点 `[121.157,27.8255]`。没有通过移动图层“对齐”。

## 检查和构建

```sh
npm test
npm run geo:check
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# 无系统 Chrome 时：npx playwright install chromium，然后去掉 CHANNEL
npm run preview -- --host 127.0.0.1 --port 4173
```

本轮浏览器测试实际启动 WebGL，验证画面、操作、移动端触控、地形和网格数据缺失、WebGL 失败降级。生产预览没有开发调试界面。

持续移动性能采样（先启动开发服务器）：

```sh
PLAYWRIGHT_CHANNEL=chrome node scripts/benchmark-map.mjs
```

默认依次测 1440×900、390×844、844×390，各 180 秒；`MAP_URL` 可指定开发服务器地址。结果写入 `docs/performance/` 和 `docs/screenshots/`。这是桌面 Chrome 模拟，不等于真机验证。

## 离线数据再处理

已有成果可直接运行，不需要重新下载。Python 数据处理依赖单独安装：

```sh
python3 -m venv .venv-geo
.venv-geo/bin/pip install -r scripts/requirements-geography.txt
```

数据顺序（OSM 缓存与当前 bbox 保持一致）：

```sh
# 下载记录中的原 DEM（命中缓存时只校验 SHA-256，不联网）
node scripts/fetch-dem.mjs
.venv-geo/bin/python scripts/process-dem.py
# 可选重新读取合法公开温州原始文件；使用 Range，只下载对应成员
.venv-geo/bin/python scripts/fetch-buildings.py
.venv-geo/bin/python scripts/process-buildings.py
# 从同一 OSM 快照先生成陆地，再生成相同 bbox 的地形缓存
npx tsx scripts/process-geo.ts --prepare-terrain
npm run geo:bake
# 组合数据、统计质量
npm run geo:process
.venv-geo/bin/python scripts/audit-geography.py
npx tsx scripts/qa-geography.ts
# 已保留参考影像；重新下载/处理需联网读取已记录 Sentinel 场景
.venv-geo/bin/python scripts/process-reference.py
```

`geo:fetch` 保留原缓存优先规则，`--refresh` 才主动请求 Overpass。更改 bbox 或 OSM 海岸后，必须重新处理陆地并烘焙地形；不能把旧网格搭配新岸线。原始温州文件和 GeoTIFF 是本机可复现缓存，不进入前端。

## 主要文件

- `src/game/world/terrain.ts`：原始 DSM 双线性查询、最终三角面高度索引、海陆判断、道路面贴地裁剪。
- `src/game/world/player.ts`：出生点、扫掠碰撞、坡度限制；建筑使用 25m 空间桶。
- `src/game/world/roads.ts` / `buildings.ts`：真实 footprint/道路拓扑渲染。
- `src/game/geo/poiNormalization.ts`：有凭证的高德归一化入口，当前未接入真实转换服务。
- `data/dongao/quality-report.json`：机器可读质量结论；`controls.json` 区分 OSM 原点、参考点和采用点。
- `data/dongao/dem/`：原始高度、烘焙网格、来源/校验和；`sources/` 记录建筑与影像来源。

项目没有自动提交、推送或部署。所有未通过事项在交付报告中区分“必须修 / 建议修 / 可以进入下一阶段”。
