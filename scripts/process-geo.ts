import osmToGeoJson from "osmtogeojson";
import { mkdir, copyFile } from "node:fs/promises";
import type { Feature, FeatureCollection } from "geojson";
import { readJson, writeJson } from "./lib/io";
import {
  clipFeature,
  collection,
  makeLand,
  representativePoint,
} from "./lib/geometry";
import { GEO_CONFIG } from "../src/game/geo/geoConfig";
import { validateBounds } from "../src/game/geo/coordinates";

const base = "data/dongao",
  output = "public/data/dongao";
const raw = await readJson(`${base}/osm.raw.json`),
  manifest = await readJson(`${base}/fetch-manifest.json`);
const dimensions = validateBounds(GEO_CONFIG.bbox);
if (JSON.stringify(manifest.bbox) !== JSON.stringify(GEO_CONFIG.bbox))
  throw new Error("Cached bbox mismatch; fetch the configured extent first.");
if (raw.remark) throw new Error("OSM response is incomplete");
const all = osmToGeoJson(raw, { flatProperties: true }) as FeatureCollection;
if (all.features.some((f) => f.properties?.tainted))
  throw new Error("Incomplete OSM geometry: tainted relation or way");
const clipped = all.features
  .map((f) => clipFeature(f, GEO_CONFIG.bbox))
  .filter((f): f is Feature => !!f);
const filter = (predicate: (p: Record<string, any>) => boolean) =>
  collection(clipped.filter((f) => predicate(f.properties || {})));
const layers: Record<string, FeatureCollection> = {
  roads: filter((p) => !!p.highway),
  buildings: filter((p) => !!p.building && p.building !== "no"),
  coastline: filter((p) => p.natural === "coastline"),
  water: filter((p) => p.natural === "water" || !!p.waterway),
  landuse: filter(
    (p) => !!p.landuse || ["beach", "wood", "scrub"].includes(p.natural),
  ),
  pois: filter(
    (p) =>
      !!p.name &&
      (!!p.place ||
        !!p.tourism ||
        !!p.amenity ||
        !!p.historic ||
        p.natural === "beach"),
  ),
};
Object.assign(layers, makeLand(all, layers.coastline, GEO_CONFIG.bbox));
const pois = layers.pois.features
  .filter((f) => f.properties?.place !== "island")
  .flatMap((f) => {
    const p = representativePoint(f.geometry);
    return p
      ? [
          {
            id: String(f.id || f.properties?.id),
            name: f.properties!.name,
            longitude: p[0],
            latitude: p[1],
            type:
              f.properties!.natural === "beach"
                ? "beach"
                : f.properties!.place || "poi",
            crs: "EPSG:4326",
            source: "OpenStreetMap",
            sourceUrl: `https://www.openstreetmap.org/${f.id || f.properties?.id}`,
            positionMethod:
              f.geometry.type === "Point"
                ? "osm-node"
                : "polygon-interior-point",
          },
        ]
      : [];
  });
const counts = Object.fromEntries(
  Object.entries(layers).map(([k, v]) => [k, v.features.length]),
);
const warnings = [
  `OSM 建筑轮廓仅 ${counts.buildings} 个，不能代表村庄完整建筑分布；未生成虚构住宅。`,
  "OSM 道路仅表示已采集路网；巷道、入口及通行状态需现场核对。",
  "DEM 未接入；当前为零高程平面，不表示真实山体。",
  "POI 面要素使用面内代表点，不表示真实入口。",
];
const report = {
  schemaVersion: 1,
  status: "awaiting-osm-review",
  config: GEO_CONFIG,
  dimensions,
  counts,
  poiCount: pois.length,
  warnings,
  source: manifest,
  dem: null,
  buildingHeights:
    "OSM height/levels when available, otherwise deterministic illustrative heights",
  coastMethod:
    "Complete OSM island relation polygons and closed coastline rings, union + bbox intersection; sea = bbox minus land. All coastline vertices checked against land boundaries.",
};
// Compute/validate everything before writing output, so invalid topology doesn't replace a working map.
await mkdir(output, { recursive: true });
for (const [name, data] of Object.entries(layers)) {
  await writeJson(`${base}/${name}.geojson`, data);
  await copyFile(`${base}/${name}.geojson`, `${output}/${name}.geojson`);
}
await writeJson(`${base}/pois.json`, pois);
await copyFile(`${base}/pois.json`, `${output}/pois.json`);
await writeJson(`${base}/quality-report.json`, report);
await copyFile(`${base}/quality-report.json`, `${output}/quality-report.json`);
await writeJson(`${output}/world.json`, { ...layers, pois, report });
console.log(
  JSON.stringify(
    { dimensions, counts, poiCount: pois.length, warnings },
    null,
    2,
  ),
);
