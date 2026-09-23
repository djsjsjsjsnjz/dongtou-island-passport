import type { FeatureCollection, Geometry, Position } from "geojson";
import { GEO_CONFIG } from "../geo/geoConfig";
import { worldToGeo } from "../geo/coordinates";
export type HeightField = {
  crs: string;
  bbox: number[];
  width: number;
  height: number;
  west: number;
  north: number;
  dx: number;
  dy: number;
  nodata: number | null;
  values: (number | null)[];
  source: string;
};
export function inRing(x: number, z: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      x >= Math.min(a[0], b[0]) - 1e-10 &&
      x <= Math.max(a[0], b[0]) + 1e-10 &&
      z >= Math.min(a[1], b[1]) - 1e-10 &&
      z <= Math.max(a[1], b[1]) + 1e-10
    ) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = dx * dx + dz * dz;
      if (len) {
        const t = Math.max(
          0,
          Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len),
        );
        if ((x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2 < 1e-20)
          return true;
      }
    }
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function contains(g: Geometry, x: number, z: number): boolean {
  const polys =
    g.type === "Polygon"
      ? [g.coordinates]
      : g.type === "MultiPolygon"
        ? g.coordinates
        : [];
  return polys.some(
    (r) => inRing(x, z, r[0]) && !r.slice(1).some((h) => inRing(x, z, h)),
  );
}
export function interpolateDem(
  d: HeightField,
  lon: number,
  lat: number,
): number | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  let x = (lon - d.west) / d.dx,
    y = (d.north - lat) / d.dy;
  if (
    x < -1e-7 ||
    y < -1e-7 ||
    x > d.width - 1 + 1e-7 ||
    y > d.height - 1 + 1e-7
  )
    return null;
  x = Math.max(0, Math.min(d.width - 1, x));
  y = Math.max(0, Math.min(d.height - 1, y));
  const ix = Math.min(d.width - 2, Math.floor(x)),
    iy = Math.min(d.height - 2, Math.floor(y)),
    fx = x - ix,
    fy = y - iy;
  const samples = [
    [ix, iy, (1 - fx) * (1 - fy)],
    [ix + 1, iy, fx * (1 - fy)],
    [ix, iy + 1, (1 - fx) * fy],
    [ix + 1, iy + 1, fx * fy],
  ];
  let result = 0,
    weight = 0;
  for (const [cx, cy, w] of samples) {
    const v = d.values[cy * d.width + cx];
    if (v !== null && Number.isFinite(v) && v !== d.nodata) {
      result += v * w;
      weight += w;
    }
  }
  return weight > 1e-9 ? result / weight : null;
}
let terrainTriangles: Float32Array | null = null;
const triangleCells = new Map<string, number[]>();
/** The rendered piecewise-linear terrain is the final collision surface. Raw DSM remains bilinear. */
export function installTerrainSurface(positions: Float32Array) {
  terrainTriangles = positions;
  triangleCells.clear();
  for (let i = 0; i < positions.length; i += 9) {
    const xs = [positions[i], positions[i + 3], positions[i + 6]],
      zs = [positions[i + 2], positions[i + 5], positions[i + 8]];
    for (
      let x = Math.floor((Math.min(...xs) - 0.001) / 24);
      x <= Math.floor((Math.max(...xs) + 0.001) / 24);
      x++
    )
      for (
        let z = Math.floor((Math.min(...zs) - 0.001) / 24);
        z <= Math.floor((Math.max(...zs) + 0.001) / 24);
        z++
      ) {
        const key = `${x},${z}`,
          a = triangleCells.get(key) || [];
        a.push(i);
        triangleCells.set(key, a);
      }
  }
}
function surfaceHeight(x: number, z: number) {
  const p = terrainTriangles!;
  let boundaryHeight: number | null = null;
  for (const i of triangleCells.get(
    `${Math.floor(x / 24)},${Math.floor(z / 24)}`,
  ) || []) {
    const ax = p[i],
      az = p[i + 2],
      bx = p[i + 3],
      bz = p[i + 5],
      cx = p[i + 6],
      cz = p[i + 8];
    if (
      x < Math.min(ax, bx, cx) - 0.001 ||
      x > Math.max(ax, bx, cx) + 0.001 ||
      z < Math.min(az, bz, cz) - 0.001 ||
      z > Math.max(az, bz, cz) + 0.001
    )
      continue;
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-10) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d,
      v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d,
      w = 1 - u - v;
    if (u >= -1e-7 && v >= -1e-7 && w >= -1e-7)
      return u * p[i + 1] + v * p[i + 4] + w * p[i + 7];
    if (
      u >= (-0.001 * Math.hypot(bx - cx, bz - cz)) / Math.abs(d) &&
      v >= (-0.001 * Math.hypot(ax - cx, az - cz)) / Math.abs(d) &&
      w >= (-0.001 * Math.hypot(ax - bx, az - bz)) / Math.abs(d)
    ) {
      const a = Math.max(0, Math.min(1, u)),
        b = Math.max(0, Math.min(1, v)),
        c = Math.max(0, Math.min(1, w));
      boundaryHeight =
        (a * p[i + 1] + b * p[i + 4] + c * p[i + 7]) / (a + b + c);
    }
  }
  return boundaryHeight;
}
let dem: HeightField | null = null,
  land: FeatureCollection | null = null,
  water: FeatureCollection | null = null;
export const terrainStatus = {
  mode: "copernicus-dsm",
  hasDem: false,
  exaggeration: 1,
};
export function configureTerrain(
  field: HeightField,
  landData: FeatureCollection,
  waterData?: FeatureCollection,
) {
  if (
    field.crs !== "EPSG:4326" ||
    JSON.stringify(field.bbox) !== JSON.stringify(GEO_CONFIG.bbox) ||
    field.values.length !== field.width * field.height ||
    field.width < 2 ||
    field.height < 2 ||
    !(field.dx > 0) ||
    !(field.dy > 0) ||
    field.values.some((v) => v !== null && !Number.isFinite(v))
  )
    throw new Error("DEM 缓存无效或坐标基准不一致");
  terrainTriangles = null;
  triangleCells.clear();
  dem = field;
  land = landData;
  water = waterData || null;
  terrainStatus.hasDem = true;
}
export function isLand(x: number, z: number) {
  const p = worldToGeo(x, z);
  return !!land?.features.some((f) =>
    contains(f.geometry, p.longitude, p.latitude),
  );
}
export function queryTerrain(x: number, z: number) {
  const p = worldToGeo(x, z),
    b = GEO_CONFIG.bbox;
  const inBounds =
    p.longitude >= b[0] - 1e-9 &&
    p.longitude <= b[2] + 1e-9 &&
    p.latitude >= b[1] - 1e-9 &&
    p.latitude <= b[3] + 1e-9;
  const raw =
    dem && inBounds ? interpolateDem(dem, p.longitude, p.latitude) : null;
  const onLand = isLand(x, z);
  const onWater = !!water?.features.some((f) =>
    contains(f.geometry, p.longitude, p.latitude),
  );
  return {
    onWater,
    raw,
    rendered: !inBounds
      ? null
      : !onLand
        ? 0
        : raw === null
          ? null
          : terrainTriangles
            ? surfaceHeight(x, z)
            : Math.max(0, raw) * terrainStatus.exaggeration,
    onLand,
    inBounds,
  };
}
export function getTerrainHeight(x: number, z: number) {
  const h = queryTerrain(x, z).rendered;
  if (h === null)
    throw new Error(
      `DEM 高度缺失 (${x.toFixed(3)}, ${z.toFixed(3)})：禁止以零高程替代陆地`,
    );
  return h;
}
export function slopeAt(x: number, z: number) {
  const h = (a: number, b: number) => queryTerrain(a, b).rendered;
  const l = h(x - 1, z),
    r = h(x + 1, z),
    n = h(x, z - 1),
    s = h(x, z + 1);
  if ([l, r, n, s].some((v) => v === null)) return 90;
  return (Math.atan(Math.hypot((r! - l!) / 2, (s! - n!) / 2)) * 180) / Math.PI;
}
/** Clip a convex road ribbon against terrain faces, preserving its XY footprint exactly.
 * Each resulting vertex is on the actual rendered face, so wide roads cannot cut through a hill. */
export function drapeConvexPolygon(
  polygon: number[][],
  offset = 0.16,
): number[] {
  if (!terrainTriangles)
    throw new Error("Terrain surface must be installed before road draping");
  const p = terrainTriangles,
    ids = new Set<number>(),
    out: number[] = [];
  const xs = polygon.map((p) => p[0]),
    zs = polygon.map((p) => p[1]);
  for (
    let x = Math.floor(Math.min(...xs) / 24);
    x <= Math.floor(Math.max(...xs) / 24);
    x++
  )
    for (
      let z = Math.floor(Math.min(...zs) / 24);
      z <= Math.floor(Math.max(...zs) / 24);
      z++
    )
      for (const i of triangleCells.get(`${x},${z}`) || []) ids.add(i);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (const i of ids) {
    const triangle = [
        [p[i], p[i + 2]],
        [p[i + 3], p[i + 5]],
        [p[i + 6], p[i + 8]],
      ],
      area = cross(triangle[0], triangle[1], triangle[2]);
    if (Math.abs(area) < 1e-8) continue;
    let clipped = polygon;
    for (let e = 0; e < 3 && clipped.length; e++) {
      const a = triangle[e],
        b = triangle[(e + 1) % 3],
        next: number[][] = [];
      for (let j = 0; j < clipped.length; j++) {
        const c = clipped[j],
          d = clipped[(j + 1) % clipped.length],
          sc = cross(a, b, c) * Math.sign(area),
          sd = cross(a, b, d) * Math.sign(area),
          inside = sc >= -1e-8;
        if (inside) next.push(c);
        if (inside !== sd >= -1e-8) {
          const t = sc / (sc - sd);
          next.push([c[0] + t * (d[0] - c[0]), c[1] + t * (d[1] - c[1])]);
        }
      }
      clipped = next;
    }
    for (let j = 1; j < clipped.length - 1; j++) {
      if (Math.abs(cross(clipped[0], clipped[j], clipped[j + 1])) < 1e-8)
        continue;
      for (const q of [clipped[0], clipped[j], clipped[j + 1]]) {
        const u = cross(triangle[1], triangle[2], q) / area,
          v = cross(triangle[2], triangle[0], q) / area,
          w = 1 - u - v;
        out.push(
          q[0],
          u * p[i + 1] + v * p[i + 4] + w * p[i + 7] + offset,
          q[1],
        );
      }
    }
  }
  return out;
}
