import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import polygonClipping from "polygon-clipping";
import {
  clipLine,
  clipFeature,
  inPolygon,
  representativePoint,
  makeLand,
  collection,
} from "./geometry";
import { GEO_CONFIG } from "../../src/game/geo/geoConfig";
const load = (n: string) =>
  JSON.parse(readFileSync(`data/dongao/${n}.geojson`, "utf8"));
const area = (polys: number[][][][]) =>
  polys.reduce(
    (sum, p) =>
      sum +
      p.reduce(
        (a, r, i) =>
          a +
          (i ? -1 : 1) *
            Math.abs(
              r
                .slice(1)
                .reduce((s, v, k) => s + r[k][0] * v[1] - v[0] * r[k][1], 0) /
                2,
            ),
        0,
      ),
    0,
  );
describe("GIS clipping and real Dongao coverage", () => {
  it("does not bridge a line that exits and reenters the bbox", () => {
    const parts = clipLine(
      [
        [0.5, 0.5],
        [2, 0.5],
        [2, 2],
        [0.5, 0.8],
      ],
      [0, 0, 1, 1],
    );
    expect(parts).toHaveLength(2);
    expect(parts[0].at(-1)).toEqual([1, 0.5]);
  });
  it("preserves polygon holes and keeps representative points on land", () => {
    const g = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [1, 3],
          [3, 3],
          [3, 1],
          [1, 1],
        ],
      ],
    };
    const f = clipFeature(
      { type: "Feature", properties: {}, geometry: g },
      [0, 0, 4, 4],
    )!;
    expect(f.geometry.type).toBe("MultiPolygon");
    const p = representativePoint(g)!;
    expect(inPolygon(p, g.coordinates)).toBe(true);
  });
  it("fails instead of inventing land from an open coast", () => {
    expect(() =>
      makeLand(collection([]), collection([]), [0, 0, 1, 1]),
    ).toThrow("No complete island");
  });
  it("land and ocean have no overlap and exactly cover the bbox", () => {
    const land = load("land").features[0].geometry.coordinates,
      sea = load("sea").features[0].geometry.coordinates;
    expect(polygonClipping.intersection(land, sea)).toHaveLength(0);
    const b = GEO_CONFIG.bbox;
    expect(area(land) + area(sea)).toBeCloseTo(
      (b[2] - b[0]) * (b[3] - b[1]),
      10,
    );
  });
  it("locates the village on land and preserves OSM land-left / water-right orientation", () => {
    const land = load("land").features[0].geometry.coordinates,
      b = GEO_CONFIG.bbox;
    const onLand = (p: number[]) =>
      land.some((poly: number[][][]) => inPolygon(p, poly));
    expect(onLand([121.1567624, 27.8257104])).toBe(true);
    for (const f of load("coastline").features)
      for (const line of f.geometry.coordinates)
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1],
            c = line[i],
            dx = c[0] - a[0],
            dy = c[1] - a[1],
            length = Math.hypot(dx, dy);
          if (length < 1e-5) continue;
          const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
            epsilon = 1e-7;
          if (
            mid[0] < b[0] + 1e-5 ||
            mid[0] > b[2] - 1e-5 ||
            mid[1] < b[1] + 1e-5 ||
            mid[1] > b[3] - 1e-5
          )
            continue;
          expect(
            onLand([
              mid[0] - (dy / length) * epsilon,
              mid[1] + (dx / length) * epsilon,
            ]),
          ).toBe(true);
          expect(
            onLand([
              mid[0] + (dy / length) * epsilon,
              mid[1] - (dx / length) * epsilon,
            ]),
          ).toBe(false);
        }
  });
  it("publishes no coordinates outside the configured 2 km extent", () => {
    const b = GEO_CONFIG.bbox;
    const visit = (c: any) => {
      if (typeof c[0] === "number") {
        expect(c[0]).toBeGreaterThanOrEqual(b[0] - 1e-9);
        expect(c[0]).toBeLessThanOrEqual(b[2] + 1e-9);
        expect(c[1]).toBeGreaterThanOrEqual(b[1] - 1e-9);
        expect(c[1]).toBeLessThanOrEqual(b[3] + 1e-9);
      } else c.forEach(visit);
    };
    for (const n of [
      "roads",
      "buildings",
      "land",
      "sea",
      "coastline",
      "water",
      "landuse",
    ])
      for (const f of load(n).features) visit(f.geometry.coordinates);
  });
});
