# 东岙 · 真实地图骨架

基于 React、TypeScript、Vite 和原生 Three.js 的洞头东岙地图原型。当前交付范围为 **STEP 4：OSM + WGS84 坐标 + 俯视地图**，等待用户核对海岸、道路与村庄位置后再接入 DEM。

## 先运行

需要 Node.js 20.19+ / 22.12+。

```sh
npm ci
npm run dev
```

打开终端给出的本地地址，通常为 http://127.0.0.1:5173/ 。仓库自带一次合法获取的 OSM 静态缓存，**启动/构建/刷新都不请求 OSM、高德或 DEM**，不需要 API key。

- 默认正北俯视；拖动平移，滚轮/双指缩放。按 **M** 或按钮切换倾斜视角，倾斜时拖动环视。
- 点击“东岙村”“东岙沙滩”聚焦真实 POI，旁边来源链接打开原始 OSM 对象。
- 开发环境显示图层开关、100 m 网格、游标 WGS84/世界坐标、平面高度和渲染统计。生产构建不包含 DebugPanel。
- 手机地图下方有可滚动的数据/调试区。
- 原任务、印章、奖励、纪念卡和持久化在 `/?demo=legacy` 保留，默认地图不读写旧进度。[旧演示说明](docs/legacy-demo.md)。

## 当前地图事实与缺口

中心 WGS84：`121.157°E, 27.8255°N`。

Bounding Box `[west, south, east, north]`：`[121.14685, 27.81648, 121.16715, 27.83452]`，约 **1999.95 m × 1999.13 m**。

| 数据 | 本次结果 |
| --- | --- |
| 道路 | 49 个要素（含 1 个步行区域面） |
| 海岸 | 6 个 coastline 要素，完整岛屿关系裁剪 |
| 建筑 | **只有 1 个 footprint，覆盖严重不足** |
| 土地用途 / 自然地表 | 14 个要素，含住宅用地、沙滩、林地 |
| 命名 POI | 11 个，含东岙村、东岙沙滩 |
| DEM / 玩家 | **尚未接入，等待 OSM 审阅确认** |

褐色住宅用地不是逐栋建筑；没有随机生成房屋填补空白。建筑生成器已实现 footprint 拉伸和合并，但真实村庄建筑分布仍需有明确授权的轮廓。OSM 路网不保证巷道/入口完整。

`getTerrainHeight(x,z)` 当前返回明确的零高程审阅平面，不是地形数据。不会以平面或随机山体冒充 DEM。建筑高度优先使用 OSM height/levels，否则使用稳定的示意高度，不能当作实测。

## 离线数据流程

```sh
# 有缓存默认不联网；更改 bbox 后需要显式刷新
npm run geo:fetch
# 主动更新才访问 Overpass：
npm run geo:fetch -- --refresh
# 仅处理本地缓存，输出 GeoJSON、POI、质量报告及浏览器 bundle
npm run geo:process
npm run dev
```

bbox 输入与唯一坐标原点在 `data/dongao/config.json`；两边不允许超过 3 km，原点必须在范围内。当前陆海处理依赖完整岛屿多边形，适合本次东岙范围；更换到无完整岛屿关系的区域会明确报错，不能自动猜测开放海岸的封口方向。

`geo:fetch` 使用系统 curl（支持系统 HTTPS 代理），90 秒超时；公共 API 失败时不覆盖缓存，不自动重试轰炸。可在 `.env.local` 配置非秘密的 `OVERPASS_URL`。原始快照为此次 bbox 命中的完整 OSM 对象，包含跨界岛屿边界用于正确裁剪；浏览器数据全部限制在 bbox 内。

```text
data/dongao/
  config.json                  # WGS84 唯一原点与 bbox
  location-evidence.json        # 村庄/沙滩原始定位证据
  osm.raw.json                  # Overpass 完整几何快照
  fetch-manifest.json           # 获取时间、查询、许可
  roads.geojson / buildings.geojson / coastline.geojson
  land.geojson / sea.geojson / water.geojson / landuse.geojson
  pois.geojson / pois.json      # 后者为统一 WGS84 代表点
  quality-report.json          # 覆盖统计、缺口、DEM 状态
  dem/README.md                # 下一阶段合法 DEM 获取说明
public/data/dongao/             # 处理产物；运行时只加载 world.json
```

经纬度原始数据是事实来源，worldX/worldZ 始终通过投影派生。`geoToWorld(latitude,longitude)`，`worldToGeo(x,z)`；GeoJSON 数组顺序固定 `[longitude,latitude]`。世界单位米，+X 向东、-Z 向北、+Y 向上。使用 WGS84 椭球在原点处的局部平面近似，仅面向 ≤3 km 的本地图。

道路按 OSM 类型设置示意宽度，保留折线拓扑；桥梁稍抬高、隧道变灰仅为审阅表达，暂无高程剖面。海面是 **bbox 减去真实陆地 polygon**，没有用整张海平面穿过陆地。多边形保留洞，验证海陆无重叠且覆盖整个范围。

## 代码结构

```text
src/game/geo/       配置、坐标类型、WGS84 投影与范围约束
src/game/data/      静态数据读取、schema 和坐标配置校验
src/game/world/     陆海/土地用途、合并道路、合并 footprint 建筑、POI、渲染生命周期
src/game/camera/    俯视/倾斜镜头、平移范围、缩放
src/game/ui/        审阅布局、开发专用 DebugPanel
src/services/amap/  GCJ-02 接口占位，不执行 API 请求或坐标转换
scripts/           采集、裁剪、质量检查
```

GIS 依赖仅供开发脚本使用，不进入浏览器。`osmtogeojson` 的 XML 间接依赖已覆盖为修复版本；本项目只解析 JSON。浏览器没有引入 R3F/Next.js，也没有新增服务器。

## 验证

```sh
npm run geo:fetch     # 应命中缓存、不访问网络
npm run geo:process
npm run geo:check     # GIS 脚本 TypeScript 检查
npm test             # 坐标/裁剪/陆海一致性 + 原进度回归
npm run build        # 应用 TypeScript + Vite
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# 或 npx playwright install chromium 后 npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4173
```

测试截图与性能采样在 `test-results/`，验证结论在 [阶段验证记录](docs/phase-one-validation.md)。统计值包括当前 RAF FPS、draw calls、三角面、几何体和可用时的 JS heap；JS heap 不是 GPU 显存或设备总内存。

手机尺寸模拟不能证明真实手机 30 FPS。当前不宣称完整第一阶段十项验收通过，也没有承诺地图与现实完全一致。下一步需用户确认 OSM 空间方向，并补足建筑覆盖；随后才接 DEM 和步行玩家。

## 数据来源与后续输入

[来源/许可登记](docs/data-sources.md) · [仓库审计与改造方案](docs/repository-audit.md)。页面保留 © OpenStreetMap contributors 和 ODbL 链接，源数据与派生 GIS 数据按 ODbL-1.0 提供。

DEM 候选为 Copernicus GLO-30，可从公开 AWS 数据取得；OpenTopography 按账户/API 权限取得。待地图确认后才实现 GeoTIFF 裁剪和 height field 处理，详见 [DEM 说明](data/dongao/dem/README.md)。

高德只预留 GCJ-02 类型接口，未接入数据。任何未来 POI 必须先通过合法可靠的转换流程统一为 WGS84。`AMAP_API_KEY` / `OPENTOPOGRAPHY_API_KEY` 只能保存在被忽略的 `.env.local`，不能加 `VITE_` 前缀，也不能提交或打包进前端。未来高德 Web 服务 key 需服务端调用。

项目仍可用原 `npm run deploy` 发布 GitHub Pages，但本次修改没有自动推送或发布。
