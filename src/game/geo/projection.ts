import type { GeoCoordinate, WorldCoordinate } from "./geoTypes";

/** Local tangent-plane linearization of the WGS84 ellipsoid, suitable for this <=3 km map.
 * East +X, north -Z, meters. This is not Web Mercator and does not accept GCJ-02. */
export function createProjection(center: GeoCoordinate) {
  assertWgs84(center);
  const radians = Math.PI / 180;
  const a = 6378137,
    e2 = 6.6943799901413165e-3;
  const phi = center.latitude * radians;
  const denominator = 1 - e2 * Math.sin(phi) ** 2;
  const eastScale = (a / Math.sqrt(denominator)) * Math.cos(phi) * radians;
  const northScale = ((a * (1 - e2)) / denominator ** 1.5) * radians;
  if (Math.abs(eastScale) < 1e-6)
    throw new Error("Polar origins are not supported");
  return {
    geoToWorld(latitude: number, longitude: number): WorldCoordinate {
      assertWgs84({ latitude, longitude });
      return {
        x: (longitude - center.longitude) * eastScale,
        z: -(latitude - center.latitude) * northScale,
      };
    },
    worldToGeo(x: number, z: number): GeoCoordinate {
      if (!Number.isFinite(x) || !Number.isFinite(z))
        throw new Error("Invalid world coordinates");
      const result = {
        longitude: center.longitude + x / eastScale,
        latitude: center.latitude - z / northScale,
      };
      assertWgs84(result);
      return result;
    },
  };
}
export function assertWgs84(p: GeoCoordinate) {
  if (
    !Number.isFinite(p.latitude) ||
    !Number.isFinite(p.longitude) ||
    Math.abs(p.latitude) > 90 ||
    Math.abs(p.longitude) > 180
  )
    throw new Error("Invalid WGS84 longitude/latitude");
}
