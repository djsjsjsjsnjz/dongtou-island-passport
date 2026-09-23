import type { WorldData } from "./types";
import { GEO_CONFIG } from "../geo/geoConfig";
export async function loadWorld(signal: AbortSignal): Promise<WorldData> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/dongao/world.json`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      `地图缓存读取失败 (${response.status})。请先运行 npm run geo:process。`,
    );
  const data = (await response.json()) as WorldData;
  if (
    data.report?.schemaVersion !== 1 ||
    JSON.stringify(data.report.config) !== JSON.stringify(GEO_CONFIG)
  )
    throw new Error("地图缓存与当前坐标配置不一致，请重新运行 geo:process。");
  for (const key of [
    "roads",
    "buildings",
    "coastline",
    "land",
    "sea",
    "water",
    "landuse",
  ] as const)
    if (data[key]?.type !== "FeatureCollection")
      throw new Error(`地图缺少 ${key} 图层`);
  if (!Array.isArray(data.pois) || data.pois.some((p) => p.crs !== "EPSG:4326"))
    throw new Error("POI 必须为 WGS84");
  return data;
}
