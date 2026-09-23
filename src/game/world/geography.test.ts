import { beforeEach, describe, it, expect } from "vitest";
import fs from "node:fs";
import type { WorldData } from "../data/types";
import {
  configureTerrain,
  installTerrainSurface,
  interpolateDem,
  queryTerrain,
  getTerrainHeight,
  slopeAt,
  contains,
  type HeightField,
} from "./terrain";
import { geoToWorld, worldToGeo } from "../geo/coordinates";
import { roadSegments, buildRoads } from "./roads";
import { buildBuildings } from "./buildings";
import { createPlayer, MAX_SLOPE } from "./player";
import { QA_ROUTE } from "./qaRoute";
import { disposeWorld } from "./layers";
import { normalizeAmapPoi, poiDistance } from "../geo/poiNormalization";
import * as THREE from "three";
const data = JSON.parse(
  fs.readFileSync("public/data/dongao/world.json", "utf8"),
) as WorldData;
const rawMesh = fs.readFileSync("data/dongao/dem/terrain.f32");
const triangleBuffer = new Float32Array(
  rawMesh.buffer.slice(
    rawMesh.byteOffset,
    rawMesh.byteOffset + rawMesh.byteLength,
  ),
);
beforeEach(() => {
  configureTerrain(data.dem, data.land, data.water);
  installTerrainSurface(triangleBuffer);
});
it("bilinear native pixel centers, partial nodata, all nodata, exact edges and outside", () => {
  const d: HeightField = {
    crs: "EPSG:4326",
    bbox: [],
    width: 2,
    height: 2,
    west: 120,
    north: 28,
    dx: 1,
    dy: 1,
    nodata: -9999,
    values: [0, 10, 20, 30],
    source: "synthetic unit fixture",
  };
  expect(interpolateDem(d, 120.5, 27.5)).toBe(15);
  expect(interpolateDem(d, 121, 27)).toBe(30);
  expect(interpolateDem(d, 121.1, 27)).toBeNull();
  expect(interpolateDem(d, NaN, 28)).toBeNull();
  d.values = [null, 10, 20, 30];
  expect(interpolateDem(d, 120.5, 27.5)).toBe(20);
  d.values.fill(-9999);
  expect(interpolateDem(d, 120.5, 27.5)).toBeNull();
});
it("DEM provenance and real relief, inclusive bbox edge, sea and bounds", () => {
  expect(data.dem.source).toContain("Copernicus");
  expect(
    Math.max(...data.dem.values.filter((v): v is number => v !== null)),
  ).toBeGreaterThan(110);
  const edge = geoToWorld(27.8316814589307, 121.16715);
  expect(queryTerrain(edge.x, edge.z).rendered).toBeGreaterThan(50);
  expect(queryTerrain(0, 800).rendered).toBe(0);
  expect(queryTerrain(2000, 0).rendered).toBeNull();
  expect(() => getTerrainHeight(2000, 0)).toThrow();
  expect(() =>
    configureTerrain({ ...data.dem, crs: "GCJ-02" }, data.land),
  ).toThrow();
});
it("road types retain bridges above sea, omit tunnels from ordinary surface, preserve centerline land relation", () => {
  const s = roadSegments(data.roads);
  expect(s.filter((x) => x.issues.includes("non-bridge-water"))).toHaveLength(
    0,
  );
  const bridge = s.filter((x) => x.bridge);
  expect(Math.min(...bridge.map((x) => x.a.y))).toBeGreaterThan(20);
  expect(s.some((x) => x.tunnel)).toBe(true); // No steps are mapped in this OSM snapshot; verify the type using a tagged copy.
  const fixture = structuredClone(data.roads);
  fixture.features.find(
    (f) => f.geometry.type === "MultiLineString",
  )!.properties!.highway = "steps";
  expect(roadSegments(fixture).some((x) => x.kind === "steps")).toBe(true);
  const mesh = buildRoads(data.roads);
  expect(mesh.children.length).toBeGreaterThan(0);
  disposeWorld(mesh);
});
it("all real footprints have sources, uniform provisional height, bottom vertices follow DEM within 6cm", () => {
  expect(data.buildings.features.length).toBeGreaterThan(2000);
  expect(data.buildings.features.every((f) => f.properties?.sourceUrl)).toBe(
    true,
  );
  const g = buildBuildings(data.buildings);
  let bases = 0,
    maxPenetration = 0;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const a = o.geometry.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        const delta = a.getY(i) - getTerrainHeight(a.getX(i), a.getZ(i));
        if (delta < 1) {
          bases++;
          maxPenetration = Math.max(maxPenetration, Math.abs(delta));
        }
      }
    }
  });
  expect(bases).toBeGreaterThan(10000);
  expect(maxPenetration).toBeLessThan(0.061);
  disposeWorld(g);
}, 20000);
it("swept player follows shared DEM through actual road to beach arrival without teleport", () => {
  const p = createPlayer(data);
  let maxError = 0,
    maxSlope = 0;
  for (const target of QA_ROUTE.slice(1)) {
    const t = geoToWorld(target.latitude, target.longitude);
    let n = 0;
    while (Math.hypot(p.state.x - t.x, p.state.z - t.z) > 0.25 && n++ < 2000) {
      p.move(t.x - p.state.x, t.z - p.state.z, 0.1);
      expect(p.state.blocked).toBe("");
      maxError = Math.max(
        maxError,
        Math.abs(p.state.y - getTerrainHeight(p.state.x, p.state.z)),
      );
      maxSlope = Math.max(maxSlope, p.state.slope);
    }
    expect(n).toBeLessThan(2000);
  }
  expect(p.state.distance).toBeGreaterThan(140);
  expect(p.state.distance).toBeLessThan(150);
  expect(maxError).toBeLessThan(0.001);
  expect(maxSlope).toBeLessThan(MAX_SLOPE);
  const beach = data.landuse.features.find((f) => f.id === "way/836480414")!;
  expect(contains(beach.geometry, p.state.longitude, p.state.latitude)).toBe(
    true,
  );
}, 20000);
it("movement blocks sea, footprint and over-limit terrain without tunnelling", () => {
  const p = createPlayer(data);
  p.state.x = 0;
  p.state.z = 700;
  p.state.y = 0;
  p.move(0, 1, 1);
  expect(p.state.blocked).toContain("海域");
  const g = data.buildings.features[0].geometry;
  const ring =
    g.type === "Polygon"
      ? g.coordinates[0]
      : g.type === "MultiPolygon"
        ? g.coordinates[0][0]
        : [];
  const xy = geoToWorld(ring[0][1], ring[0][0]);
  Object.assign(p.state, xy, { y: getTerrainHeight(xy.x, xy.z) });
  p.move(1, 0, 0.1);
  expect(p.state.blocked).toContain("建筑");
  // A real >35° DSM slope is located deterministically; all steep land must be refused.
  let tested = false;
  for (let x = -800; x < 800 && !tested; x += 10)
    for (let z = -800; z < 800 && !tested; z += 10) {
      if (queryTerrain(x, z).onLand && slopeAt(x, z) > 36) {
        Object.assign(p.state, { x, z, y: getTerrainHeight(x, z) });
        p.move(0.1, 0.1, 0.05);
        expect(p.state.blocked).not.toBe("");
        tested = true;
      }
    }
  expect(tested).toBe(true);
});
describe("POI coordinate admission", () => {
  const poi = {
    id: "fixture",
    name: "synthetic conversion fixture",
    longitude: 121.16,
    latitude: 27.823,
    crs: "GCJ-02" as const,
  };
  it("rejects raw GCJ-02 and undocumented conversions; retains original plus receipt", async () => {
    await expect(normalizeAmapPoi(poi)).rejects.toThrow("授权");
    const receipt = {
      longitude: 121.157,
      latitude: 27.8255,
      crs: "EPSG:4326" as const,
      provider: "unit-test mock (not an operational provider)",
      method: "fixture",
      authorizationRef: "fixture",
      convertedAt: "2026-09-23T00:00:00Z",
      accuracyMeters: 1,
    };
    await expect(
      normalizeAmapPoi(poi, async () => ({ ...receipt, authorizationRef: "" })),
    ).rejects.toThrow();
    const p = await normalizeAmapPoi(poi, async () => receipt);
    expect(p.original).toEqual(poi);
    expect(
      worldToGeo(
        ...(Object.values(geoToWorld(p.latitude, p.longitude)) as [
          number,
          number,
        ]),
      ).longitude,
    ).toBeCloseTo(p.longitude, 8);
    expect(poiDistance(p, receipt)).toBe(0);
  });
});

it("ordinary road surfaces stay on the rendered terrain including wide bends and coastal approaches", () => {
  const ordinary = {
    ...data.roads,
    features: data.roads.features.filter(
      (f) => !f.properties?.bridge && !f.properties?.tunnel,
    ),
  };
  const group = buildRoads(ordinary);
  let maxGap = 0,
    minGap = Infinity,
    count = 0;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const p = o.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i += 3) {
        const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3,
          z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3,
          y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3,
          q = queryTerrain(x, z);
        if (!q.onLand || q.rendered === null) continue;
        const gap = y - q.rendered;
        maxGap = Math.max(maxGap, gap);
        minGap = Math.min(minGap, gap);
        count++;
      }
    }
  });
  expect(count).toBeGreaterThan(30000);
  expect(minGap).toBeGreaterThan(0);
  expect(maxGap).toBeLessThan(0.18);
  disposeWorld(group);
});
