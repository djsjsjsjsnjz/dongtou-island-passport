# 东岙沙滩 Game Scene · Step 1 切片验收

生成时间：2026-09-23。来源基线：`a7168d8 Preserve full Dongao spatial prototype`。本阶段只建立独立入口、裁切数据包、基础验证场景和 DevOnly 地理工具；没有制作环境美术，也没有进入 Step 2。

## A. 场景范围

| 项目 | 最终值 |
| --- | --- |
| 请求中心 | `121.157210, 27.824210` |
| bbox 精确中心 | `121.157210, 27.824205` |
| 核心 bbox | `[121.15518, 27.82240, 121.15924, 27.82601]` |
| 核心尺寸 | `399.99 × 400.05m` |
| 视觉缓冲 | 核心区每侧 `100m` |
| 缓冲 bbox | `[121.1541649763, 27.8214976085, 121.1602550237, 27.8269123915]` |
| 含缓冲尺寸 | `599.99 × 600.05m` |

采用 400m 核心区，没有扩到 500m。沙滩完整落在核心区；后方主要聚落、道路连续段和背山近坡均进入核心区或 100m 缓冲。沙滩 footprint 最大跨度约 182.66m，沿岸两端在核心边界前仍有空间。

临时出生点：WGS84 `121.1563900, 27.8246000`；世界坐标 `X=-60.097m, Y=0.960m, Z=99.735m`；原始 DEM `0.944m`；坡度 `5.11°`。这是冻结版已经完成无碰撞路线验证的沙滩到达点，位于核心区、陆地和建筑外，能直接看到沙滩。该点仍是“玩家到达点”，不是经过现场核验的真实入口。

## B. 俯视与构图证据

- [核心区域俯视图](screenshots/beach-step1-core.png)
- [核心区和视觉缓冲俯视图](screenshots/beach-step1-core-buffer.png)
- [地图区域无侧栏版本](screenshots/beach-step1-core-buffer-map.png)
- [Beach Scene 与冻结 Debug Map 对照](screenshots/beach-step1-comparison.png)
- [View A：沙滩向村庄](screenshots/beach-step1-view-a.png)
- [View B：村庄向海](screenshots/beach-step1-view-b.png)
- [View C：沿沙滩方向](screenshots/beach-step1-view-c.png)

构图检查：

- **View A** 能同时看到海、完整沙滩、后方道路、村庄建筑和上升山坡。OSM 在沙滩最后约 21m 仍缺少经核实的步道或入口，这一数据缺口没有用虚构道路填补。
- **View B** 从村庄侧能够辨认海面和沙滩，建筑与道路关系连续，核心边界没有切到沙滩。
- **View C** 保留了约 183m 的真实沙滩长度，沙滩两端没有直接贴住核心边界。高位倾斜 QA 镜头仍会看到最外层 600m 数据边缘；这是 Step 2 需要通过低 LOD 背景和镜头约束处理的视觉问题，不是坐标偏移。

## C. 数据对齐

| 图层 | 结果 |
| --- | --- |
| Coastline | 从冻结 OSM 要素按缓冲 bbox 数学裁切，source ID 和原顶点保留；与 Debug Map 对齐 |
| Beach | 保留 `way/836480414` 的真实面和方向；没有移动、缩放或重画 |
| Roads | 4 个真实道路要素，拓扑和类型不变，只在视觉缓冲边界裁切 |
| Buildings | 376 个完整 footprint，位置、方向、source ID 和暂定高度逻辑不变 |
| DEM | 从 77×69 原始样本网格截取 26×23 精确样本窗口；相同点插值结果与完整 DEM 一致 |
| Terrain mesh | 从冻结地形三角面在原世界 X/Z 平面裁切，交点 Y 沿原三角面插值 |
| Projection | 仍使用原点 `121.157, 27.8255`，WGS84、米制、+X 东 / -Z 北 / +Y 上 |

自动测试以 `1e-8` 精度比较裁切前后的 DEM 双线性查询；没有发现整体平移、轴交换或经纬度顺序错误。

## D. 边界问题

- **山体被截断**：核心区没有直接截断；600m 视觉缓冲的外缘必然结束近坡数据。高位 View A/B/C 能看到外缘，后续游戏镜头和低 LOD 背景仍需处理。
- **道路突然消失**：核心区内没有因裁切产生的终点；道路在 100m 缓冲外缘结束。沙滩最后约 21m 无已测道路，属于源数据缺口。
- **建筑被切一半**：没有。17 个跨越最外层缓冲边界的建筑被整体省略，没有裁成半栋；清单记录在 manifest。
- **海岸边缘异常**：未发现。海岸、陆地和 sea 均从同一冻结源裁切。
- **海水穿陆**：未发现。当前切片没有内陆水体要素，海面占位来自 `buffer bbox - OSM land`。
- **视觉边界暴露**：俯视 QA 主动显示核心和缓冲边界；高位倾斜镜头能看到最外缘硬边。普通核心区活动不会立即到达数据边缘。
- **玩家活动区过窄**：未发现。核心区 400m，沙滩约 183m，后方村路和两侧陆地均保留。是否需要扩大只能在 Step 2 的最终第三人称镜头高度下再次判断。

## E. 数据统计

| 数据 | 冻结 2×2km | 沙滩切片 | 减少 |
| --- | ---: | ---: | ---: |
| 建筑 | 2,789 | 376 | 86.52% |
| 道路要素 | 49 | 4 | 91.84% |
| Coastline | 6 | 1 | 83.33% |
| DEM | 77×69 / 5,313 samples | 26×23 / 598 samples | 88.74% samples |
| Terrain mesh | 61,992 triangles / 2,231,712 bytes | 6,085 triangles / 219,060 bytes | 90.18% triangles |
| GeoJSON 合计 | 2,082,393 bytes | 283,404 bytes | 86.39% |
| 运行时 world + terrain | 4,354,455 bytes | 517,816 bytes | 88.11% |

`public/data/dongao-beach/` 全目录为 825,103 bytes，其中包含运行时数据、独立 GeoJSON、碰撞清单、许可和 manifest，因此存在为审阅保留的重复表示。

## F. 独立入口

- Beach Game Scene：`/beach/`，查询参数兼容入口为 `/?scene=beach`。
- Debug Map：`/debug/map/`，根路径 `/` 和 `/?scene=debug` 也继续进入冻结版。

两个入口共享 WGS84 投影、地形查询、道路、建筑和玩家碰撞模块，但使用不同的数据包、页面组件和 Three.js 场景树。Beach Scene 的 DevOnly 面板包含坐标、高程、核心/缓冲边界、图层开关、构图视角和 Debug Map 跳转；生产构建不显示该面板。

## G. 验证状态

- `npm test`：31 tests passed。
- `npm run geo:check`：通过。
- `npx tsc -b`：通过。
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/beach.spec.ts`：2 tests passed。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：13 tests passed，包含原 Spatial Prototype、移动端触控、DEM 降级和 50 秒真实路线回归。
- `npm run build`：通过。

## Step 1 结论

这块范围可以作为第一张游戏地图的地理切片候选：海、沙滩、村庄、道路和近山关系同时存在，数据规模比冻结原型显著缩小，且没有重新选原点或手工移动真实图层。

当前停止在 Step 1。没有制作沙滩材质、动态海面、植被、礁石、栏杆、路灯、渔村资产、天空、灯光、雾效、NPC、任务或剧情。需先确认本范围，再进入 Step 2。
