import type { WorldData } from "./types";
import { configureTerrain } from "../world/terrain";
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
  if (!data.dem)
    throw new Error("DEM 数据缺失，不能启动地形与玩家。请运行 geo:process。");
  configureTerrain(data.dem, data.land, data.water);
  if (
    !data.terrainMesh ||
    JSON.stringify(data.terrainMesh.bbox) !== JSON.stringify(GEO_CONFIG.bbox) ||
    JSON.stringify(data.terrainMesh.center) !==
      JSON.stringify(GEO_CONFIG.center)
  )
    throw new Error("DEM 网格配置缺失或不匹配");
  const meshResponse = await fetch(
    `${import.meta.env.BASE_URL}data/dongao/dem/terrain.f32`,
    { signal },
  );
  if (!meshResponse.ok) throw new Error("DEM 网格缓存读取失败");
  const bytes = await meshResponse.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (
    bytes.byteLength !== data.terrainMesh.bytes ||
    bytes.byteLength % 36 !== 0 ||
    hash !== data.terrainMesh.sha256
  )
    throw new Error("DEM 网格缓存损坏");
  data.terrainPositions = new Float32Array(bytes);
  return data;
}
