# 东岙地图改造：仓库审计与阶段边界

审计基线：`021bc7b`，2026-09-22。当前本地仓库 origin 指向用户指定 GitHub 仓库。审阅全部 src、测试、配置和 README；基线 8 个单元测试与 TypeScript / Vite build 通过。

## 当前架构

Vite + React 19 + TypeScript + Three.js。没有 React Three Fiber、Rapier、Zustand 或后端。

- `src/Scene.tsx`：React forwardRef 包装原生 Three.js 生命周期。正交镜头、OrbitControls、Ray-free DOM 景点标签、光照、ShaderMaterial 海面、人物移动、渔船动画、释放 GPU 资源均集中于 createIsland。
- 岸线 15 个手写世界坐标构成 Shape / ExtrudeGeometry；山体是固定种子的随机 Icosahedron；房屋、树木、码头、沙滩装饰均手写坐标。
- `src/data.ts`：五个剧情点位 + 7 个 WALKWAY 节点。所谓寻路是在线性节点数组中前后移动；没有真实路网、地理投影、碰撞或高程。
- `src/App.tsx`：任务、护照、奖励、移动端抽屉、持久化和 WebGL 降级。
- `src/progress.ts`：纯 reducer、去重、进度校验、localStorage。`src/card.ts`：Canvas2D 纪念卡。
- 性能基础：DPR 1.5、共享几何材质、隐藏页停帧、卸载释放资源。旧场景仍存在很多独立 draw calls。

## 保留 / 替换

保留旧 App、任务、印章、卡片、进度键、响应式 UI 和回归测试，通过 `?demo=legacy` 进入。当前地图审阅不触发旧进度。

默认入口替换为 OSM 世界。旧 coast、WALKWAY、POINT_NODE、虚构商户坐标、随机山体和装饰只留在历史演示中，不能迁入新世界。待新地图与后续玩法均验收后再删除旧 Scene；现在不破坏已有可运行演示。

不迁移到 Next/R3F，不增加后端、NPC 或任务。新增依赖仅用于离线 GIS：tsx、osmtogeojson、polygon-clipping、GeoJSON 类型；浏览器沿用 Three.js。

## 真实地图架构

- `data/dongao/config.json`：唯一 WGS84 原点和 bbox；longitude / latitude 明确命名，GeoJSON 固定 [lon, lat]。
- `src/game/geo/`：WGS84 椭球原点处局部等距近似；米为世界单位，东为 +X、北为 -Z、上为 +Y；正反转换和范围检查。2 km 范围精度足够做骨架，非测绘工具。
- `scripts/fetch-osm.ts`：bbox 查询，一次缓存原始响应和来源时间；有缓存默认不联网，显式 --refresh 更新。
- `scripts/process-geo.ts`：OSM→GeoJSON、完整岛屿 polygon 与封闭岸线裁剪、质量报告、复制运行时静态数据；不访问网络。
- `src/game/world/`：陆地/海面 polygon、合并道路、合并 footprint 建筑、POI。无 DEM 时只有明确标识的零高程基准平面。
- `src/game/camera/`：正北向上俯视 / 倾斜正交镜头、缩放、平移、范围限制。
- `src/game/ui/`：开发环境专用图层及坐标面板，检查游标位置，绝不伪称玩家坐标。
- `src/services/amap/`：仅类型/接口占位，GCJ-02 禁止进入 WGS84 数据；未来 key 仅服务端。

## 地理依据和范围

直接查询 OSM 得到 village node/13607433057：121.1567624, 27.8257104；beach way/836480414：东岙沙滩。原始定位响应保存在 data/dongao/location-evidence.json。

原点 121.157, 27.8255；bbox [121.14685, 27.81648, 121.16715, 27.83452]，约 2.00 × 2.00 km。范围中心是渲染原点，不宣称景点入口。沙滩 POI 从真实面内部取代表点，不能当作测量入口。

## 数据要求与后续顺序

1. 现在交付 OSM + 坐标 + 俯视审阅：道路、岸线、建筑、沙滩、POI；报告真实覆盖率和缺失，不伪造。
2. **等待用户确认空间方向**，或提供需纠正的位置、授权 footprint / GPS 点。OSM 不是现实完整性的证明。
3. 确认后读取 `data/dongao/dem/*.tif`（Copernicus GLO-30 优先），检查水平 CRS、垂直基准、NoData、分辨率；裁剪为有限 height field，统一 getTerrainHeight。道路细分贴地，建筑按 footprint 地基采样；高度比例单独记录。
4. 再加入轻量光照、玩家步行和贴地；保持约 2 km 范围。最后实机评估桌面 60 / 手机 30 FPS 目标。

外部数据清单：WGS84 中心/bbox（已定位）、OSM 道路/岸线/footprint/土地用途/沙滩/POI（本轮采集）、DEM GeoTIFF（等 OSM 确认后）、带朝向和拍摄位置的授权实景照片、关键地标 GPS 坐标和入口、可合法导入的建筑轮廓（如 OSM 覆盖不足）。

本轮不宣称山体、玩家或全阶段十项验收完成；这是用户指定 STEP 4 地图确认点。
