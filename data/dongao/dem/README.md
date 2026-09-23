# DEM 接入待地图确认

本阶段按用户 STEP 4 只审阅 OSM，未导入 DEM，没有随机山体或伪高程。

确认后可将合法获取的 GeoTIFF 放在此目录（已 gitignore）。优先 Copernicus GLO-30：https://registry.opendata.aws/copernicus-dem/ ，公开 AWS 数据无需 OpenTopography key。

也可在 https://portal.opentopography.org/ 注册，查看账户 API key 与所选数据权限；将 key 保存为根目录 `.env.local` 中的 `OPENTOPOGRAPHY_API_KEY`。本轮未实现 DEM 下载/处理命令，不能声称放入文件即可运行地形。

后续处理必须验证 EPSG、像元顺序、NoData、DSM/DTM 属性和垂直基准。GLO-30 是 DSM，不能把 30m 像元解释为巷道级实测地面。地图确认后再实现裁剪、采样、height field 和统一贴地查询。
