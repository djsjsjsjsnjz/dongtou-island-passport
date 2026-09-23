# 地图数据来源与许可

获取日期：2026-09-22；精确 UTC 时间和 OSM 数据快照时间以 `data/dongao/fetch-manifest.json` 为准。

| 数据 | 来源 / 原始对象 | 许可 / 状态 | 用途 |
| --- | --- | --- | --- |
| 道路、building、water、landuse、自然地表、POI | [OpenStreetMap](https://www.openstreetmap.org/copyright)，[Overpass](https://overpass-api.de/api/interpreter) bbox 查询 | ODbL-1.0；已缓存 | 统一 WGS84 静态地理骨架 |
| 东岙村 | [node/13607433057](https://www.openstreetmap.org/node/13607433057) | ODbL-1.0；已取得 | 原点选择依据、村庄定位 |
| 东岙沙滩 | [way/836480414](https://www.openstreetmap.org/way/836480414) | ODbL-1.0；已取得 | 沙滩真实 polygon、面内 POI 代表点 |
| 洞头岛边界 | [relation/9683940](https://www.openstreetmap.org/relation/9683940) | ODbL-1.0；已取得 | 完整岛屿 polygon 裁剪，只展示范围内部分 |
| 半屏岛边界 | [relation/20242949](https://www.openstreetmap.org/relation/20242949) | ODbL-1.0；已取得 | 范围西南角的真实对岸关系 |
| 岸线 | `coastline.geojson` 所列 6 个 OSM way | ODbL-1.0；已取得 | 边界描线、验证陆地在有向线左侧 |
| Copernicus GLO-30 | [AWS 官方开放数据目录](https://registry.opendata.aws/copernicus-dem/) / [Copernicus 数据空间](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) | **候选，未下载未使用**；下一阶段下载时保存其数据许可与指定 attribution | GeoTIFF → height field；DSM 并非裸地 DTM |
| OpenTopography | [开发者入口](https://opentopography.org/developers) | **候选，未调用**；不同数据集和账户权限分别核对 | 可选 DEM 获取渠道 |
| 高德 | 未取得 / 未调用 | 不存在本轮授权导入数据 | 未来仅经合法授权与 GCJ-02 归一化后接入 |
| 实景照片 / 补充建筑 footprint | 等用户提供带来源和许可的资料 | 未收到，未使用 | 后续地标比例、机位和村庄覆盖校正 |

## OSM 使用方式

本轮一次定位查询、一次区域下载，开发/网页启动不访问公共接口。源响应、获取方式与日期保留在仓库，派生 GeoJSON 同时发布到 public/data/dongao。完整跨界对象只用于正确面化/裁剪；运行时所有几何都限制在约 2 × 2 km 内。

署名遵循 [OSMF Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)，地图中持续可见“© OpenStreetMap contributors · ODbL”，链接至 [版权与许可](https://www.openstreetmap.org/copyright)。数据文件见相邻 LICENSE.md。后续商业运营应根据用途与分发方式履行 ODbL 要求，公共 Overpass 不是运行时商业地图服务。

岸线语义依据 [OSM natural=coastline](https://wiki.openstreetmap.org/wiki/Tag:natural%3Dcoastline)：沿线方向陆在左、海在右，通常表示大潮平均高潮岸线。因此不等于实时潮位或现场当天沙滩水线。

## 不能从这份数据推断的内容

建筑仅一个 footprint，无法证明村庄房屋密度/位置已还原。POI 中沙滩、学校的坐标是 polygon 内代表点，不是真实入口。地形目前明确缺失；树木覆盖以 OSM 林地区域表示，没有随机种树伪装调查结果。道路宽度与无 height 标签的建筑高度是可审阅的显示参数，不是原始测量值。
