import type { FeatureCollection } from "geojson";
import type { GeoConfig, GeoCoordinate } from "../geo/geoTypes";
export type Poi = GeoCoordinate & {
  id: string;
  name: string;
  type: string;
  crs: "EPSG:4326";
  sourceUrl: string;
  positionMethod: string;
};
export type WorldData = Record<
  "roads" | "buildings" | "coastline" | "water" | "landuse" | "land" | "sea",
  FeatureCollection
> & {
  terrainPositions?: Float32Array;
  terrainMesh: {
    bytes: number;
    sha256: string;
    bbox: number[];
    center: { longitude: number; latitude: number };
  };
  dem: import("../world/terrain").HeightField;
  pois: Poi[];
  report: {
    schemaVersion: number;
    config: GeoConfig;
    counts: Record<string, number>;
    poiCount: number;
    dimensions: { width: number; depth: number };
    warnings: string[];
    source: { retrievedAt: string; osmTimestamp: string };
    dem: Record<string, unknown>;
  };
};
