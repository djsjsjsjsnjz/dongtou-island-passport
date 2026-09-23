import { describe, it, expect } from "vitest";
import { geoToWorld, worldToGeo, validateBounds } from "./coordinates";
import { GEO_CONFIG } from "./geoConfig";
import { buildingHeight } from "../world/buildings";
describe("WGS84 local meter coordinates", () => {
  it("places the shared origin at zero and north at negative Z", () => {
    expect(geoToWorld(27.8255, 121.157)).toEqual({ x: 0, z: -0 });
    expect(geoToWorld(27.8265, 121.158).x).toBeCloseTo(98.52, 1);
    expect(geoToWorld(27.8265, 121.158).z).toBeCloseTo(-110.82, 1);
  });
  it("roundtrips landmarks and all bbox corners to submillimeter precision", () => {
    for (const [lat, lon] of [
      [27.8257104, 121.1567624],
      [GEO_CONFIG.bbox[1], GEO_CONFIG.bbox[0]],
      [GEO_CONFIG.bbox[3], GEO_CONFIG.bbox[2]],
    ]) {
      const w = geoToWorld(lat, lon),
        g = worldToGeo(w.x, w.z);
      expect(g.latitude).toBeCloseTo(lat, 10);
      expect(g.longitude).toBeCloseTo(lon, 10);
    }
  });
  it("rejects swapped axes, NaN and oversized areas", () => {
    expect(() => geoToWorld(121.157, 27.8255)).toThrow();
    expect(() => worldToGeo(NaN, 0)).toThrow();
    expect(() => validateBounds([121.1, 27.8, 121.2, 27.9])).toThrow();
    expect(validateBounds(GEO_CONFIG.bbox).width).toBeCloseTo(2000, 0);
  });
  it("uses measured building metadata before deterministic illustrative heights", () => {
    expect(buildingHeight("a", { height: "18 m" })).toBe(18);
    expect(buildingHeight("a", { "building:levels": 3 })).toBe(9);
    expect(buildingHeight("a", {})).toBe(buildingHeight("a", {}));
    expect(buildingHeight("a", {})).toBeGreaterThanOrEqual(4);
  });
});
