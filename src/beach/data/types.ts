import type { FeatureCollection } from "geojson";
import type { WorldData } from "../../game/data/types";
import type { BoundingBox, GeoCoordinate } from "../../game/geo/geoTypes";

export type BeachSpawn = GeoCoordinate & {
  worldX: number;
  worldY: number;
  worldZ: number;
  rawDemHeight?: number;
  slopeDegrees?: number;
  reason: string;
};

export type BeachSlice = {
  schemaVersion: number;
  id: string;
  crs: "EPSG:4326";
  projectionOrigin: GeoCoordinate;
  sourceSnapshotCommit: string;
  requestedCenter: GeoCoordinate;
  center: GeoCoordinate;
  coreBbox: BoundingBox;
  bufferBbox: BoundingBox;
  coreSizeMeters: { width: number; depth: number };
  bufferSizeMeters: { width: number; depth: number };
  visualBufferMeters: number;
  spawn: BeachSpawn;
};

export type BeachManifest = BeachSlice & {
  files: Record<string, string>;
  counts: {
    source: Record<string, number>;
    output: Record<string, number>;
    sourcePois: number;
    outputPois: number;
    omittedBoundaryCrossingBuildings: number;
  };
  dem: {
    sourceWidth: number;
    sourceHeight: number;
    outputWidth: number;
    outputHeight: number;
    sourceSamples: number;
    outputSamples: number;
  };
  terrain: WorldData["terrainMesh"] & { triangles: number };
  sizes: {
    sourceGeojsonBytes: number;
    outputGeojsonBytes: number;
    geojsonReductionPercent: number;
    sourceRuntimeBytes: number;
    outputRuntimeBytes: number;
    runtimeReductionPercent: number;
  };
  provenance: Record<string, string>;
  boundaryReview: Record<string, number | boolean>;
};

export type BeachWorldData = WorldData & {
  beach: FeatureCollection;
  slice: BeachSlice;
  collision: {
    playableBbox: BoundingBox;
    buildingSourceIds: (string | number | undefined)[];
  };
  manifest: BeachManifest;
};
