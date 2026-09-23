import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  Position,
} from "geojson";
import { GEO_CONFIG } from "../src/game/geo/geoConfig";
import { geoToWorld, worldToGeo } from "../src/game/geo/coordinates";
import type { BoundingBox } from "../src/game/geo/geoTypes";
import {
  contains,
  interpolateDem,
  type HeightField,
} from "../src/game/world/terrain";
import { clipFeature, collection } from "./lib/geometry";
import { readJson, writeJson } from "./lib/io";

const SOURCE_COMMIT = "a7168d8";
const sourceRoot = "public/data/dongao";
const outputRoot = "public/data/dongao-beach";
const coreBbox: BoundingBox = [121.15518, 27.8224, 121.15924, 27.82601];
const bufferMeters = 100;
const requestedCenter = { longitude: 121.15721, latitude: 27.82421 };
const spawn = { longitude: 121.15639, latitude: 27.8246 };

const coreSW = geoToWorld(coreBbox[1], coreBbox[0]);
const coreNE = geoToWorld(coreBbox[3], coreBbox[2]);
const bufferedSW = worldToGeo(
  coreSW.x - bufferMeters,
  coreSW.z + bufferMeters,
);
const bufferedNE = worldToGeo(
  coreNE.x + bufferMeters,
  coreNE.z - bufferMeters,
);
const bufferBbox: BoundingBox = [
  bufferedSW.longitude,
  bufferedSW.latitude,
  bufferedNE.longitude,
  bufferedNE.latitude,
];
const center = {
  longitude: (coreBbox[0] + coreBbox[2]) / 2,
  latitude: (coreBbox[1] + coreBbox[3]) / 2,
};
const coreSize = {
  width: coreNE.x - coreSW.x,
  depth: coreSW.z - coreNE.z,
};
const bufferSize = {
  width: coreSize.width + bufferMeters * 2,
  depth: coreSize.depth + bufferMeters * 2,
};

function coordinates(g: Geometry): Position[] {
  if (g.type === "Point") return [g.coordinates];
  if (g.type === "MultiPoint" || g.type === "LineString")
    return g.coordinates;
  if (g.type === "MultiLineString" || g.type === "Polygon")
    return g.coordinates.flat();
  if (g.type === "MultiPolygon") return g.coordinates.flat(2);
  return [];
}

function fullyInside(feature: Feature, bbox: BoundingBox) {
  const points = coordinates(feature.geometry);
  return (
    points.length > 0 &&
    points.every(
      ([longitude, latitude]) =>
        longitude >= bbox[0] &&
        longitude <= bbox[2] &&
        latitude >= bbox[1] &&
        latitude <= bbox[3],
    )
  );
}

function clipCollection(data: FeatureCollection, bbox: BoundingBox) {
  return collection(
    data.features
      .map((feature) => clipFeature(feature, bbox))
      .filter((feature): feature is Feature => feature !== null),
  );
}

function retainWholeBuildings(data: FeatureCollection, bbox: BoundingBox) {
  const intersecting = data.features.filter((feature) =>
    clipFeature(feature, bbox),
  );
  const retained = intersecting.filter((feature) => fullyInside(feature, bbox));
  return {
    collection: collection(retained),
    crossingBoundary: intersecting.length - retained.length,
  };
}

function cropHeightField(source: HeightField, bbox: BoundingBox): HeightField {
  const x0 = Math.max(0, Math.floor((bbox[0] - source.west) / source.dx) - 1);
  const x1 = Math.min(
    source.width - 1,
    Math.ceil((bbox[2] - source.west) / source.dx) + 1,
  );
  const y0 = Math.max(
    0,
    Math.floor((source.north - bbox[3]) / source.dy) - 1,
  );
  const y1 = Math.min(
    source.height - 1,
    Math.ceil((source.north - bbox[1]) / source.dy) + 1,
  );
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const values: (number | null)[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      values.push(source.values[y * source.width + x]);
  const west = source.west + x0 * source.dx;
  const north = source.north - y0 * source.dy;
  return {
    ...source,
    bbox: [...bbox],
    west,
    north,
    width,
    height,
    values,
    source: `${source.source}; exact sample-window crop for Dong'ao Beach slice`,
  };
}

type Vertex = [x: number, y: number, z: number];

function clipPolygon3d(
  input: Vertex[],
  inside: (vertex: Vertex) => boolean,
  intersection: (a: Vertex, b: Vertex) => Vertex,
) {
  const output: Vertex[] = [];
  for (let index = 0; index < input.length; index++) {
    const current = input[index];
    const previous = input[(index + input.length - 1) % input.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside !== previousInside)
      output.push(intersection(previous, current));
    if (currentInside) output.push(current);
  }
  return output;
}

function clipTerrain(source: Float32Array, bbox: BoundingBox) {
  const sw = geoToWorld(bbox[1], bbox[0]);
  const ne = geoToWorld(bbox[3], bbox[2]);
  const bounds = {
    minX: sw.x,
    maxX: ne.x,
    minZ: ne.z,
    maxZ: sw.z,
  };
  const planes: {
    inside: (vertex: Vertex) => boolean;
    intersect: (a: Vertex, b: Vertex) => Vertex;
  }[] = [
    {
      inside: ([x]) => x >= bounds.minX - 1e-6,
      intersect: (a, b) => interpolateVertex(a, b, 0, bounds.minX),
    },
    {
      inside: ([x]) => x <= bounds.maxX + 1e-6,
      intersect: (a, b) => interpolateVertex(a, b, 0, bounds.maxX),
    },
    {
      inside: (([, , z]) => z >= bounds.minZ - 1e-6),
      intersect: (a, b) => interpolateVertex(a, b, 2, bounds.minZ),
    },
    {
      inside: (([, , z]) => z <= bounds.maxZ + 1e-6),
      intersect: (a, b) => interpolateVertex(a, b, 2, bounds.maxZ),
    },
  ];
  const output: number[] = [];
  for (let offset = 0; offset < source.length; offset += 9) {
    let polygon: Vertex[] = [
      [source[offset], source[offset + 1], source[offset + 2]],
      [source[offset + 3], source[offset + 4], source[offset + 5]],
      [source[offset + 6], source[offset + 7], source[offset + 8]],
    ];
    for (const plane of planes)
      polygon = clipPolygon3d(polygon, plane.inside, plane.intersect);
    for (let index = 1; index < polygon.length - 1; index++)
      output.push(...polygon[0], ...polygon[index], ...polygon[index + 1]);
  }
  return new Float32Array(output);
}

function terrainHeightAt(source: Float32Array, x: number, z: number) {
  for (let offset = 0; offset < source.length; offset += 9) {
    const ax = source[offset];
    const ay = source[offset + 1];
    const az = source[offset + 2];
    const bx = source[offset + 3];
    const by = source[offset + 4];
    const bz = source[offset + 5];
    const cx = source[offset + 6];
    const cy = source[offset + 7];
    const cz = source[offset + 8];
    if (
      x < Math.min(ax, bx, cx) - 1e-4 ||
      x > Math.max(ax, bx, cx) + 1e-4 ||
      z < Math.min(az, bz, cz) - 1e-4 ||
      z > Math.max(az, bz, cz) + 1e-4
    )
      continue;
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-10) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    const w = 1 - u - v;
    if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6)
      return u * ay + v * by + w * cy;
  }
  return null;
}

function interpolateVertex(
  a: Vertex,
  b: Vertex,
  axis: 0 | 2,
  value: number,
): Vertex {
  const denominator = b[axis] - a[axis];
  const t = Math.abs(denominator) < 1e-12 ? 0 : (value - a[axis]) / denominator;
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function isInsideBbox(longitude: number, latitude: number, bbox: BoundingBox) {
  return (
    longitude >= bbox[0] &&
    longitude <= bbox[2] &&
    latitude >= bbox[1] &&
    latitude <= bbox[3]
  );
}

async function bytes(path: string) {
  return (await stat(path)).size;
}

const sourceWorld = await readJson(`${sourceRoot}/world.json`);
const sourceDem = sourceWorld.dem as HeightField;
const sourceTerrainBuffer = await readFile(`${sourceRoot}/dem/terrain.f32`);
const sourceTerrain = new Float32Array(
  sourceTerrainBuffer.buffer,
  sourceTerrainBuffer.byteOffset,
  sourceTerrainBuffer.byteLength / 4,
);

if (
  JSON.stringify(sourceWorld.report.config) !== JSON.stringify(GEO_CONFIG) ||
  sourceDem.crs !== "EPSG:4326"
)
  throw new Error("Frozen Spatial Prototype projection/config mismatch");

const sourceLayers = Object.fromEntries(
  await Promise.all(
    [
      "roads",
      "buildings",
      "coastline",
      "water",
      "landuse",
      "land",
      "sea",
      "pois",
    ].map(async (name) => [
      name,
      await readJson<FeatureCollection>(`${sourceRoot}/${name}.geojson`),
    ]),
  ),
) as Record<string, FeatureCollection>;

const wholeBuildings = retainWholeBuildings(
  sourceLayers.buildings,
  bufferBbox,
);
const layers = {
  roads: clipCollection(sourceLayers.roads, bufferBbox),
  buildings: wholeBuildings.collection,
  coastline: clipCollection(sourceLayers.coastline, bufferBbox),
  water: clipCollection(sourceLayers.water, bufferBbox),
  landuse: clipCollection(sourceLayers.landuse, bufferBbox),
  land: clipCollection(sourceLayers.land, bufferBbox),
  sea: clipCollection(sourceLayers.sea, bufferBbox),
};
const poiGeojson = clipCollection(sourceLayers.pois, bufferBbox);
const beach = collection(
  layers.landuse.features.filter(
    (feature) =>
      feature.properties?.natural === "beach" ||
      String(feature.properties?.name || "").includes("沙滩"),
  ),
);
const pois = sourceWorld.pois.filter((poi: { longitude: number; latitude: number }) =>
  isInsideBbox(poi.longitude, poi.latitude, bufferBbox),
);
const dem = cropHeightField(sourceDem, bufferBbox);
const terrainPositions = clipTerrain(sourceTerrain, bufferBbox);
const terrainBytes = Buffer.from(
  terrainPositions.buffer,
  terrainPositions.byteOffset,
  terrainPositions.byteLength,
);
const terrainHash = createHash("sha256").update(terrainBytes).digest("hex");
const terrainMesh = {
  format: "float32-little-endian xyz triangles",
  crs: "EPSG:4326",
  projectionOrigin: GEO_CONFIG.center,
  bbox: bufferBbox,
  bytes: terrainBytes.byteLength,
  sha256: terrainHash,
  triangles: terrainPositions.length / 9,
  source: `${sourceRoot}/dem/terrain.f32 @ ${SOURCE_COMMIT}`,
  method:
    "Sutherland-Hodgman clipping in the existing world X/Z plane; Y is linearly interpolated on original terrain faces",
};

const spawnWorld = geoToWorld(spawn.latitude, spawn.longitude);
const spawnRawHeight = interpolateDem(sourceDem, spawn.longitude, spawn.latitude);
const spawnHeight = terrainHeightAt(
  terrainPositions,
  spawnWorld.x,
  spawnWorld.z,
);
const westHeight = terrainHeightAt(
  terrainPositions,
  spawnWorld.x - 1,
  spawnWorld.z,
);
const eastHeight = terrainHeightAt(
  terrainPositions,
  spawnWorld.x + 1,
  spawnWorld.z,
);
const northHeight = terrainHeightAt(
  terrainPositions,
  spawnWorld.x,
  spawnWorld.z - 1,
);
const southHeight = terrainHeightAt(
  terrainPositions,
  spawnWorld.x,
  spawnWorld.z + 1,
);
const spawnSlope = [westHeight, eastHeight, northHeight, southHeight].some(
  (height) => height === null,
)
  ? 90
  : (Math.atan(
      Math.hypot(
        (eastHeight! - westHeight!) / 2,
        (southHeight! - northHeight!) / 2,
      ),
    ) *
      180) /
    Math.PI;
const spawnOnLand = sourceLayers.land.features.some((feature) =>
  contains(feature.geometry, spawn.longitude, spawn.latitude),
);
const spawnInWater = sourceLayers.water.features.some((feature) =>
  contains(feature.geometry, spawn.longitude, spawn.latitude),
);
const spawnInBuilding = sourceLayers.buildings.features.some((feature) =>
  contains(feature.geometry, spawn.longitude, spawn.latitude),
);
if (
  !isInsideBbox(spawn.longitude, spawn.latitude, coreBbox) ||
  spawnRawHeight === null ||
  spawnHeight === null ||
  !spawnOnLand ||
  spawnInWater ||
  spawnInBuilding ||
  spawnSlope > 35
)
  throw new Error("Beach spawn is outside the core area or lacks DEM coverage");

const counts = Object.fromEntries(
  Object.entries({ ...layers, beach }).map(([name, data]) => [
    name,
    data.features.length,
  ]),
);
const collision = {
  schemaVersion: 1,
  crs: "EPSG:4326",
  projectionOrigin: GEO_CONFIG.center,
  playableBbox: coreBbox,
  terrain: "dem/terrain.f32",
  land: "land.geojson",
  water: "water.geojson",
  buildings: "buildings.geojson",
  buildingSourceIds: layers.buildings.features.map((feature) => feature.id),
  waterSourceIds: layers.water.features.map((feature) => feature.id),
  rule:
    "Core bbox is the Step 1 playable boundary. Terrain, water and complete building footprints provide collision geometry.",
};
const report = {
  schemaVersion: 1,
  status: "beach-slice-step-1",
  config: GEO_CONFIG,
  slice: {
    requestedCenter,
    center,
    coreBbox,
    bufferBbox,
    coreSizeMeters: coreSize,
    bufferSizeMeters: bufferSize,
    visualBufferMeters: bufferMeters,
  },
  dimensions: bufferSize,
  counts,
  poiCount: pois.length,
  warnings: [
    "Step 1 validation slice only; no environment-art assets or final materials are included.",
    "Buildings use real source footprints and the existing provisional height logic; boundary-crossing buildings are omitted instead of cut.",
    "Copernicus GLO-30 is approximately 30m DSM; the cropped sample window does not add elevation detail.",
  ],
  source: sourceWorld.report.source,
  dem: {
    ...sourceWorld.report.dem,
    cropBbox: dem.bbox,
    width: dem.width,
    height: dem.height,
  },
};
const slice = {
  schemaVersion: 1,
  id: "dongao-beach-step-1",
  crs: "EPSG:4326",
  projectionOrigin: GEO_CONFIG.center,
  sourceSnapshotCommit: SOURCE_COMMIT,
  requestedCenter,
  center,
  coreBbox,
  bufferBbox,
  coreSizeMeters: coreSize,
  bufferSizeMeters: bufferSize,
  visualBufferMeters: bufferMeters,
  spawn: {
    ...spawn,
    worldX: spawnWorld.x,
    worldY: spawnHeight,
    worldZ: spawnWorld.z,
    rawDemHeight: spawnRawHeight,
    slopeDegrees: spawnSlope,
    reason:
      "Existing verified beach arrival point: inside the core, on land, outside building footprints, low slope, and immediately overlooks Dong'ao Beach.",
  },
};
const world = {
  ...layers,
  beach,
  pois,
  report,
  slice,
  collision,
  dem,
  terrainMesh,
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(`${outputRoot}/dem`, { recursive: true });
for (const [name, data] of Object.entries({ ...layers, beach }))
  await writeJson(`${outputRoot}/${name}.geojson`, data);
await writeJson(`${outputRoot}/pois.geojson`, poiGeojson);
await writeJson(`${outputRoot}/pois.json`, pois);
await writeJson(`${outputRoot}/collision.json`, collision);
await writeJson(`${outputRoot}/dem/heightfield.json`, dem);
await writeJson(`${outputRoot}/dem/mesh-manifest.json`, terrainMesh);
await writeFile(`${outputRoot}/dem/terrain.f32`, terrainBytes);
await writeJson(`${outputRoot}/world.json`, world);
await copyFile(`${sourceRoot}/LICENSE.md`, `${outputRoot}/LICENSE.md`);

const geojsonNames = [
  "roads",
  "buildings",
  "coastline",
  "water",
  "landuse",
  "land",
  "sea",
  "pois",
];
const sourceGeojsonBytes = (
  await Promise.all(geojsonNames.map((name) => bytes(`${sourceRoot}/${name}.geojson`)))
).reduce((sum, value) => sum + value, 0);
const outputGeojsonBytes = (
  await Promise.all(
    [...geojsonNames, "beach"].map((name) =>
      bytes(`${outputRoot}/${name}.geojson`),
    ),
  )
).reduce((sum, value) => sum + value, 0);
const sourceRuntimeBytes =
  (await bytes(`${sourceRoot}/world.json`)) +
  (await bytes(`${sourceRoot}/dem/terrain.f32`));
const outputRuntimeBytes =
  (await bytes(`${outputRoot}/world.json`)) +
  (await bytes(`${outputRoot}/dem/terrain.f32`));
const manifest = {
  ...slice,
  files: {
    world: "world.json",
    terrain: "dem/terrain.f32",
    heightfield: "dem/heightfield.json",
    collision: "collision.json",
  },
  counts: {
    source: sourceWorld.report.counts,
    output: counts,
    sourcePois: sourceWorld.pois.length,
    outputPois: pois.length,
    omittedBoundaryCrossingBuildings: wholeBuildings.crossingBoundary,
  },
  dem: {
    sourceWidth: sourceDem.width,
    sourceHeight: sourceDem.height,
    outputWidth: dem.width,
    outputHeight: dem.height,
    sourceSamples: sourceDem.width * sourceDem.height,
    outputSamples: dem.width * dem.height,
  },
  terrain: terrainMesh,
  sizes: {
    sourceGeojsonBytes,
    outputGeojsonBytes,
    geojsonReductionPercent:
      100 * (1 - outputGeojsonBytes / sourceGeojsonBytes),
    sourceRuntimeBytes,
    outputRuntimeBytes,
    runtimeReductionPercent: 100 * (1 - outputRuntimeBytes / sourceRuntimeBytes),
  },
  provenance: {
    sourceData: `${sourceRoot} frozen at commit ${SOURCE_COMMIT}`,
    license: "LICENSE.md",
    note:
      "All retained GIS features keep their original feature id and properties. No feature is translated or manually reshaped.",
  },
  boundaryReview: {
    halfBuildings: 0,
    omittedBoundaryCrossingBuildings: wholeBuildings.crossingBoundary,
    roadsEndOnlyAtVisualBuffer: true,
    coreHasVisualBufferOnEverySide: true,
  },
};
await writeJson(`${outputRoot}/manifest.json`, manifest);

console.log(
  JSON.stringify(
    {
      coreBbox,
      bufferBbox,
      coreSize,
      bufferSize,
      counts,
      dem: manifest.dem,
      sizes: manifest.sizes,
      spawn: slice.spawn,
      omittedBoundaryCrossingBuildings: wholeBuildings.crossingBoundary,
    },
    null,
    2,
  ),
);
