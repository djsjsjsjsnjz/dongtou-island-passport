import { GEO_CONFIG } from "../../game/geo/geoConfig";
import type { BeachManifest, BeachWorldData } from "./types";
import { publicDataUrl } from "../../game/data/publicUrl";

async function sha256(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function loadBeachWorld(
  signal: AbortSignal,
): Promise<BeachWorldData> {
  const [worldResponse, manifestResponse] = await Promise.all([
    fetch(publicDataUrl("dongao-beach/world.json"), { signal }),
    fetch(publicDataUrl("dongao-beach/manifest.json"), { signal }),
  ]);
  if (!worldResponse.ok || !manifestResponse.ok)
    throw new Error(
      `沙滩切片读取失败 (${worldResponse.status}/${manifestResponse.status})。请运行 npm run geo:beach。`,
    );
  const data = (await worldResponse.json()) as BeachWorldData;
  const manifest = (await manifestResponse.json()) as BeachManifest;
  data.manifest = manifest;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.crs !== "EPSG:4326" ||
    JSON.stringify(manifest.projectionOrigin) !==
      JSON.stringify(GEO_CONFIG.center) ||
    JSON.stringify(data.report.config) !== JSON.stringify(GEO_CONFIG) ||
    JSON.stringify(data.slice.coreBbox) !==
      JSON.stringify(manifest.coreBbox) ||
    JSON.stringify(data.slice.bufferBbox) !==
      JSON.stringify(manifest.bufferBbox)
  )
    throw new Error("沙滩切片与冻结地图的 WGS84 投影或边界配置不一致");
  for (const key of [
    "roads",
    "buildings",
    "coastline",
    "water",
    "landuse",
    "land",
    "sea",
    "beach",
  ] as const)
    if (data[key]?.type !== "FeatureCollection")
      throw new Error(`沙滩切片缺少 ${key} 图层`);
  if (!data.dem || data.dem.crs !== "EPSG:4326")
    throw new Error("沙滩切片 DEM 缺失或坐标基准错误");
  const meshResponse = await fetch(
    publicDataUrl("dongao-beach/dem/terrain.f32"),
    { signal },
  );
  if (!meshResponse.ok) throw new Error("沙滩切片 DEM 网格读取失败");
  const meshBytes = await meshResponse.arrayBuffer();
  if (
    meshBytes.byteLength !== data.terrainMesh.bytes ||
    meshBytes.byteLength % 36 !== 0 ||
    (await sha256(meshBytes)) !== data.terrainMesh.sha256
  )
    throw new Error("沙滩切片 DEM 网格损坏");
  data.terrainPositions = new Float32Array(meshBytes);
  return data;
}
