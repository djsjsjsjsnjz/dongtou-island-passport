# 地理数据来源与许可（2026-09-23）

所有运行时资料在仓库内；网页不请求 OSM、DEM、高德或卫星在线接口。空间基准为 WGS84（EPSG:4326），GeoJSON 始终 `[longitude, latitude]`。原点 `121.157, 27.8255`，bbox `[121.14685,27.81648,121.16715,27.83452]`；世界单位米，+X 东、-Z 北、+Y 上。没有人工平移图层。

| 数据 | 原始来源 | 许可与取得方式 | 缓存 / 精确来源记录 |
| --- | --- | --- | --- |
| 海岸、道路、土地用途、水体、POI、1 栋建筑 | [OpenStreetMap](https://www.openstreetmap.org/copyright) / Overpass | ODbL 1.0；沿用 2026-09-22 合法快照 | `osm.raw.json`、`fetch-manifest.json`，保留原始对象 ID |
| 真实地形 | [Copernicus GLO-30 AWS](https://registry.opendata.aws/copernicus-dem/)，N27 E121，2021 release | Copernicus GLO-30 Free & Open Licence；直接下载公开 GeoTIFF | `dem/source.tif`（本机缓存）、`dem/clipped.tif`、`dem/heightfield.json`、`dem/manifest.json`（获取时间与 SHA-256）、`sources/License-COPDEM-30.pdf` |
| 补充建筑 | [Shi 等：East Asian Buildings](https://doi.org/10.5281/zenodo.8174931)，温州文件 | CC BY 4.0，许可从该记录 API 元数据核实；HTTP Range 读取 ZIP 中温州成员 | `sources/east-asia-record.json`、`sources/eab-download.json`（各原件 SHA-256）、`buildings-eab.geojson`（每栋保留 shapefile 记录索引） |
| 独立卫星审阅图 | [Sentinel-2 COG 开放数据](https://registry.opendata.aws/sentinel-2-l2a-cogs/)，`S2B_51RUL_20250320_0_L2A` | Copernicus Sentinel 免费、完整、开放数据政策；2025-03-20 原始采集 | `sources/sentinel-scene.json`、`reference/manifest.json`、同 bbox 的 `reference/sentinel-20250320.png` |
| 高德 POI | 本轮未取得 | 无已授权的逆向坐标转换服务或带转换凭证的成果；未请求/抓取高德底图 | `controls.json` 高德字段为 null；不得解读为 0 米误差 |

目录均相对于 `data/dongao/`。完整数据署名见 [LICENSE.md](../data/dongao/LICENSE.md)。原始温州 shapefile 本机缓存约 235 MB，已 gitignore；裁剪成果、许可元数据、脚本与校验和保留。DEM 原件在本机缓存，不是运行时依赖；可由来源 URL 复现。

## 地形处理

Copernicus 是 DSM（包含植被、建筑和设施影响），不是裸地 DTM。水平采样间隔 1 角秒，本地约 27.4 × 30.8 m；垂直单位米、EGM2008 正高。本轮不能证明巷道真实高程、桥面净空或台阶踏步。

`process-dem.py` 读取 GeoTIFF 原始仿射变换，按像元中心裁剪，保留插值边缘。产物为 77×69 个原始采样点，原始 nodata=null，本次实际无缺值，高程 0–114.238 m。没有噪声、手绘山体、横向移动或额外平滑。

`bake-terrain.ts` 用同一 WGS84 原点投影，200×200 个规则网格单元与真实陆地 polygon 求交。原始高程由双线性插值得到；10m 网格只改善渲染插值，不增加原始 DEM 分辨率。地形为 61,992 个三角面，Float32 XYZ 本地二进制缓存，运行时核验字节数和 SHA-256。海面为 0m，使用真实海陆掩膜；陆地缺值、损坏网格或越界查询不以零高程代替。

原始 DSM 查询与最终渲染查询分开显示：前者是原始 heightfield 双线性插值，后者是实际地形三角面的重心插值。道路、建筑、玩家共用后者；默认固定 1×，没有夸张开关或暗中放大。有效邻点的 nodata 插值重新归一化权重，全缺失返回 null，玩家阻挡。

普通道路渲染面与地形三角面求交，向上偏移 0.16m 以避免 z-fighting。桥梁不采样下方海面，使用两端 DSM 高程线性连接的暂定桥面；没有声称它是桥梁实测纵断面。隧道普通模式不渲染、不允许进入；QA 模式显示其原始平面位置。OSM 本次没有 steps 要素，类型处理经过合成标记测试，未伪造台阶数据。

## 建筑处理

原始 `.prj` 是 **WGS84 / UTM Zone 49N**，即 EPSG:32649（不是根据洞头经度猜选投影）。GDAL/PROJ 根据原件坐标系重投影到 EPSG:4326，然后裁剪相同 bbox。不得对本数据再次套 GCJ-02 转换。

源数据范围内取得 2,789 个 ML 提取轮廓。`eab-wenzhou-787672` 与 OSM `way/836475194` 重叠超过较小 footprint 的 50%，合并时优先保留 OSM；源数据不删除。最终 **2,789 栋 = 1 OSM + 2,788 EAB**。它们在整个 bbox 内形成聚落分布，陆地外面积超过 5% 的轮廓为 0；该检查不能证明逐栋实测准确。

所有无实测高度建筑统一暂定 6m：屋顶为 footprint 最高地形点 +6m，墙底沿边每 ≤2m 查询实际地形，底部嵌入 0.05m。此处 6m 是模型参数，不是影像推算楼层或实测房高。每栋保存来源 DOI、原始记录序号、许可、源 CRS 和高度状态。

**仍缺失：**近年新建/拆除、ML 漏检和误检、屋檐与真正墙基差异、逐栋高度、授权高分辨率正射/测绘核验。10m Sentinel-2 只能核验聚落轮廓和大尺度空间关系，不能消除这些缺口。

## 独立参考与 POI

卫星图由真实 Sentinel-2 TCI COG 按窗口读取，重投影至完全相同 bbox，256×256 输出，北向上。没有抓取商业地图瓦片。QA 可用 55% 透明度覆盖；生产模式不加载该审阅纹理。

人工选取的四个粗像素控制点与最近 OSM 岸线距离约 2–40m，位置判读不确定度约 20m。潮位、OSM 高潮岸线语义、影像分辨率和对应点选择都会影响结果，不能据此声称获得测量级 RMSE。超过 20m 的点作为未解决冲突保留，未用于移动任何图层。

东岙村、沙滩的原始 OSM 坐标保留。玩家出生点和到达点是另外的字段；村代表点至出生点约 75.8m，沙滩代表点至到达点约 91.4m。它们不是高德配准误差，更不是“真实入口”。路口从原始路网公共节点提取，45 个；高德与现场独立匹配尚未完成。

高德官方坐标转换接口描述的是其他坐标转入高德，不能据此声称拥有获授权的 GCJ-02 逆向转换。`normalizeAmapPoi` 因此要求外部授权转换器及提供方、方法、授权引用、时间和误差凭证；当前没有生产转换器。测试中的转换器仅是合成单元测试桩，不属于真实高德配准成果。
