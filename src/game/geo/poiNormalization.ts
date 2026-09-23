import type { AmapPoi } from "../../services/amap/amapClient";
import { geoToWorld, isInBounds } from "./coordinates";
export type ConversionReceipt = {
  longitude: number;
  latitude: number;
  crs: "EPSG:4326";
  provider: string;
  method: string;
  authorizationRef: string;
  convertedAt: string;
  accuracyMeters: number;
};
export type AuthorizedConverter = (coordinate: {
  longitude: number;
  latitude: number;
  crs: "GCJ-02";
}) => Promise<ConversionReceipt>;
/** No unaudited inverse formula and no layer offsets. A provider must return an auditable WGS84 receipt. */
export async function normalizeAmapPoi(
  p: AmapPoi,
  converter?: AuthorizedConverter,
) {
  if (
    p.crs !== "GCJ-02" ||
    !Number.isFinite(p.longitude) ||
    !Number.isFinite(p.latitude)
  )
    throw new Error("Expected original GCJ-02 coordinate");
  if (!converter)
    throw new Error("需要经授权的 GCJ-02→WGS84 转换服务；禁止直接混用");
  const r = await converter({
    longitude: p.longitude,
    latitude: p.latitude,
    crs: p.crs,
  });
  if (
    r.crs !== "EPSG:4326" ||
    !r.provider ||
    !r.method ||
    !r.authorizationRef ||
    !Number.isFinite(Date.parse(r.convertedAt)) ||
    !Number.isFinite(r.accuracyMeters) ||
    r.accuracyMeters < 0 ||
    !isInBounds(r)
  )
    throw new Error("转换凭证无效或不在当前 bbox 内");
  return {
    id: p.id,
    name: p.name,
    longitude: r.longitude,
    latitude: r.latitude,
    crs: r.crs,
    original: { ...p },
    conversion: r,
  };
}
export function poiDistance(
  a: { longitude: number; latitude: number },
  b: { longitude: number; latitude: number },
) {
  const x = geoToWorld(a.latitude, a.longitude),
    y = geoToWorld(b.latitude, b.longitude);
  return Math.hypot(x.x - y.x, x.z - y.z);
}
