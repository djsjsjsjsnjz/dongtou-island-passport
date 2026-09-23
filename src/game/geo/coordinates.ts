import { GEO_CONFIG } from "./geoConfig";
import { createProjection } from "./projection";
import type { BoundingBox, GeoCoordinate } from "./geoTypes";
export const { geoToWorld, worldToGeo } = createProjection(GEO_CONFIG.center);
export function isInBounds(
  p: GeoCoordinate,
  bbox: BoundingBox = GEO_CONFIG.bbox,
) {
  return (
    p.longitude >= bbox[0] &&
    p.longitude <= bbox[2] &&
    p.latitude >= bbox[1] &&
    p.latitude <= bbox[3]
  );
}
export function validateBounds(bbox: BoundingBox) {
  if (GEO_CONFIG.crs !== "EPSG:4326") throw new Error("Only WGS84 EPSG:4326 is accepted");
  const [w, s, e, n] = bbox;
  if (![w, s, e, n].every(Number.isFinite) || w >= e || s >= n)
    throw new Error("Invalid bbox: use west,south,east,north");
  const a = geoToWorld(s, w),
    b = geoToWorld(n, e);
  if (
    b.x - a.x > GEO_CONFIG.maxSizeMeters ||
    a.z - b.z > GEO_CONFIG.maxSizeMeters
  )
    throw new Error("MVP bbox must not exceed 3 km on either axis");
  if (!isInBounds(GEO_CONFIG.center, bbox))
    throw new Error("The configured origin must be inside bbox");
  return { width: b.x - a.x, depth: a.z - b.z };
}
