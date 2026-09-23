# 完整地理数据性能报告（冻结快照）

采样时间：2026-09-23。对象是当前 2×2km Spatial Prototype：真实 Copernicus DEM、2,789 栋建筑、完整 OSM 道路/海岸/土地用途、玩家与碰撞全部启用。每个视口连续自动行走 180 秒，往返村旁道路与沙滩到达点；测试期间没有外部网络请求、页面错误或路线中断。

这是 macOS 桌面 Chrome 140 的 headless 视口模拟，DPR=1，未做 CPU 限速，不能替代真实 iOS、Android 或微信浏览器测试。当前机器没有 `adb` 或 Xcode `devicectl` 可用设备接入。

| 视口 | 地图就绪 | 行走帧率 | Draw calls | Triangles | Geometries | Textures | 180 秒后累计移动 | CDP JS heap 变化 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 2,460ms | 116–130 FPS | 14 | 358,462 | 14 | 0 | 567.48m | -0.74MB |
| 390×844 | 2,447ms | 约 118–128 FPS | 14 | 358,462 | 14 | 0 | 567.09m | -7.57MB |
| 844×390 | 2,448ms | 117–120 FPS | 14 | 358,462 | 14 | 0 | 567.05m | -7.58MB |

开发 QA 的卫星参考图和控制点同时打开时为 73 draw calls、359,616 triangles、73 geometries、1 texture；生产模式不包含 DebugPanel、卫星纹理或测试控制接口。

运行时首批核心地理数据为：`world.json` 2,122,743 bytes（gzip 258,103），`terrain.f32` 2,231,712 bytes（gzip 411,117）。卫星 QA 图 127,928 bytes，只在开发模式按需加载。浏览器开发服务器记录的全部初次传输约 8.0MB，其中包含未压缩开发模块，不能当作配置了 Brotli/gzip 的生产 CDN 体积。

单次真实时间路线验证耗时约 47.3 秒，移动 145.00m，最终无碰撞阻塞；见 `performance/route-verification.json`。三组原始 5 秒采样、导航时序、资源列表、源码/数据 SHA-256 和环境信息见 `performance/full-data-benchmark.json`。

本结果仅说明当前冻结版在这台桌面机器的 Chrome 模拟环境中稳定。下一阶段如果转为 300–500m 的游戏场景，需要重新测动态海面、植被、灯光、阴影、PBR 材质、礁石与环境资产；本报告不能外推到未来 Game Scene。
