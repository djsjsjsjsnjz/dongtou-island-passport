import { readFileSync } from "node:fs";
import type { FeatureCollection, Geometry, Position } from "geojson";
import { describe, expect, it } from "vitest";
import { geoToWorld } from "../game/geo/coordinates";
import { GEO_CONFIG } from "../game/geo/geoConfig";
import {
  contains,
  interpolateDem,
  type HeightField,
} from "../game/world/terrain";

const read = <T>(path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as T;
const root = "public/data/dongao-beach";
const manifest = read<any>(`${root}/manifest.json`);
const world = read<any>(`${root}/world.json`);
const sourceWorld = read<any>("public/data/dongao/world.json");

function points(geometry: Geometry): Position[] {
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "MultiPoint" || geometry.type === "LineString")
    return geometry.coordinates;
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon")
    return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

describe("Dong'ao Beach Step 1 slice", () => {
  it("keeps the frozen WGS84 origin and exact 400m core with 100m buffers", () => {
    expect(manifest.crs).toBe("EPSG:4326");
    expect(manifest.projectionOrigin).toEqual(GEO_CONFIG.center);
    expect(manifest.sourceSnapshotCommit).toBe("a7168d8");
    expect(manifest.coreSizeMeters.width).toBeCloseTo(400, 1);
    expect(manifest.coreSizeMeters.depth).toBeCloseTo(400, 1);
    expect(manifest.bufferSizeMeters.width).toBeCloseTo(600, 1);
    expect(manifest.bufferSizeMeters.depth).toBeCloseTo(600, 1);
    expect(manifest.visualBufferMeters).toBe(100);
  });

  it("retains complete attributed buildings and clips every other feature to the visual buffer", () => {
    const bbox = manifest.bufferBbox as number[];
    for (const feature of world.buildings.features) {
      expect(feature.id).toBeTruthy();
      expect(feature.properties.source).toBeTruthy();
      for (const [longitude, latitude] of points(feature.geometry)) {
        expect(longitude).toBeGreaterThanOrEqual(bbox[0]);
        expect(longitude).toBeLessThanOrEqual(bbox[2]);
        expect(latitude).toBeGreaterThanOrEqual(bbox[1]);
        expect(latitude).toBeLessThanOrEqual(bbox[3]);
      }
    }
    for (const name of ["roads", "coastline", "landuse", "land", "sea"]) {
      for (const feature of world[name].features) {
        expect(feature.id || feature.properties?.source).toBeTruthy();
        for (const [longitude, latitude] of points(feature.geometry)) {
          expect(longitude).toBeGreaterThanOrEqual(bbox[0] - 1e-9);
          expect(longitude).toBeLessThanOrEqual(bbox[2] + 1e-9);
          expect(latitude).toBeGreaterThanOrEqual(bbox[1] - 1e-9);
          expect(latitude).toBeLessThanOrEqual(bbox[3] + 1e-9);
        }
      }
    }
    expect(manifest.boundaryReview.halfBuildings).toBe(0);
    expect(manifest.counts.omittedBoundaryCrossingBuildings).toBe(17);
  });

  it("uses an exact source DEM sample window and a terrain mesh inside the buffer", () => {
    const source = sourceWorld.dem as HeightField;
    const crop = world.dem as HeightField;
    for (const point of [
      world.slice.center,
      world.slice.spawn,
      { longitude: 121.1558, latitude: 27.8254 },
    ])
      expect(interpolateDem(crop, point.longitude, point.latitude)).toBeCloseTo(
        interpolateDem(source, point.longitude, point.latitude)!,
        8,
      );
    expect(crop.width).toBe(26);
    expect(crop.height).toBe(23);
    const bytes = readFileSync(`${root}/dem/terrain.f32`);
    const positions = new Float32Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength / 4,
    );
    const sw = geoToWorld(manifest.bufferBbox[1], manifest.bufferBbox[0]);
    const ne = geoToWorld(manifest.bufferBbox[3], manifest.bufferBbox[2]);
    for (let index = 0; index < positions.length; index += 3) {
      expect(positions[index]).toBeGreaterThanOrEqual(sw.x - 1e-3);
      expect(positions[index]).toBeLessThanOrEqual(ne.x + 1e-3);
      expect(positions[index + 2]).toBeGreaterThanOrEqual(ne.z - 1e-3);
      expect(positions[index + 2]).toBeLessThanOrEqual(sw.z + 1e-3);
    }
  });

  it("places the temporary player safely inside the core", () => {
    const spawn = manifest.spawn;
    const [west, south, east, north] = manifest.coreBbox;
    expect(spawn.longitude).toBeGreaterThan(west);
    expect(spawn.longitude).toBeLessThan(east);
    expect(spawn.latitude).toBeGreaterThan(south);
    expect(spawn.latitude).toBeLessThan(north);
    expect(spawn.slopeDegrees).toBeLessThan(35);
    expect(
      (world.buildings as FeatureCollection).features.some((feature) =>
        contains(feature.geometry, spawn.longitude, spawn.latitude),
      ),
    ).toBe(false);
    expect(
      (world.water as FeatureCollection).features.some((feature) =>
        contains(feature.geometry, spawn.longitude, spawn.latitude),
      ),
    ).toBe(false);
  });

  it("is materially smaller than the frozen Spatial Prototype", () => {
    expect(manifest.sizes.geojsonReductionPercent).toBeGreaterThan(80);
    expect(manifest.sizes.runtimeReductionPercent).toBeGreaterThan(80);
    expect(manifest.counts.output.buildings).toBeLessThan(
      manifest.counts.source.buildings,
    );
    expect(manifest.dem.outputSamples).toBeLessThan(
      manifest.dem.sourceSamples,
    );
  });
});
