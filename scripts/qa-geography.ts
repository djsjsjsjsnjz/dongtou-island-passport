import { readFile, writeFile, copyFile } from "node:fs/promises";
import {
  configureTerrain,
  installTerrainSurface,
  getTerrainHeight,
  queryTerrain,
  contains,
} from "../src/game/world/terrain";
import { roadSegments, buildRoads, closestRoad } from "../src/game/world/roads";
import { buildBuildings } from "../src/game/world/buildings";
import { createPlayer } from "../src/game/world/player";
import { QA_ROUTE } from "../src/game/world/qaRoute";
import { geoToWorld, worldToGeo } from "../src/game/geo/coordinates";
import type { WorldData } from "../src/game/data/types";
import * as THREE from "three";
const read = async (p: string) => JSON.parse(await readFile(p, "utf8"));
const data = (await read("public/data/dongao/world.json")) as WorldData;
configureTerrain(data.dem, data.land, data.water);
const mesh = await readFile("data/dongao/dem/terrain.f32");
installTerrainSurface(
  new Float32Array(
    mesh.buffer.slice(mesh.byteOffset, mesh.byteOffset + mesh.byteLength),
  ),
);
const roads = roadSegments(data.roads),
  types = [...new Set(roads.flatMap((s) => s.issues))];
const roadAudit = {
  segments: roads.length,
  centerlineSampleSpacingMeters: 3,
  byIssue: Object.fromEntries(
    types.map((k) => [
      k,
      {
        samples: roads.filter((s) => s.issues.includes(k)).length,
        ways: [
          ...new Set(
            roads.filter((s) => s.issues.includes(k)).map((s) => s.id),
          ),
        ],
      },
    ]),
  ),
  issues: roads
    .filter((s) => s.issues.some((k) => !k.includes("profile")))
    .map((s) => ({ ...s, geo: worldToGeo(s.a.x, s.a.z) })),
  bridge: {
    minimumDeckMeters: Math.min(
      ...roads.filter((s) => s.bridge).map((s) => s.a.y),
    ),
    profile:
      "DSM abutment interpolation; unverified clearance; never sampled from sea",
  },
  tunnel: "No surface road or traversal until longitudinal profile exists",
  steps:
    "No mapped steps in this snapshot; generalized DEM-following width/type supported, exact risers unavailable",
};
const buildings = buildBuildings(data.buildings);
let footCount = 0,
  maxBaseError = 0,
  minRoofClearance = Infinity;
buildings.traverse((o) => {
  if (o instanceof THREE.Mesh) {
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const d = p.getY(i) - getTerrainHeight(p.getX(i), p.getZ(i));
      if (d < 1) {
        footCount++;
        maxBaseError = Math.max(maxBaseError, Math.abs(d));
      } else minRoofClearance = Math.min(minRoofClearance, d);
    }
  }
});
const roadMesh = buildRoads(data.roads);
let maxRoadMeshGap = 0,
  maxBurial = 0,
  checked = 0;
let worstRoadPoint: unknown = null;
roadMesh.traverse((o) => {
  if (
    o instanceof THREE.Mesh &&
    (o.material as THREE.MeshLambertMaterial).color.getHexString() !== "e3ecee"
  ) {
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3,
        z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3,
        y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3,
        q = queryTerrain(x, z);
      if (!q.onLand || q.rendered === null) continue;
      const nearby = closestRoad(x, z, roads);
      if (nearby?.segment.bridge) continue;
      const gap = y - q.rendered;
      if (-gap > maxBurial)
        worstRoadPoint = {
          x,
          z,
          y,
          terrain: q.rendered,
          road: nearby?.segment.id,
        };
      maxRoadMeshGap = Math.max(maxRoadMeshGap, gap);
      maxBurial = Math.max(maxBurial, -gap);
      checked++;
    }
  }
});
const player = createPlayer(data),
  trace = [];
let maxSlope = 0,
  maxPlayerGroundError = 0;
for (const target of QA_ROUTE.slice(1)) {
  const t = geoToWorld(target.latitude, target.longitude);
  let n = 0;
  while (
    Math.hypot(t.x - player.state.x, t.z - player.state.z) > 0.25 &&
    n++ < 3000
  ) {
    player.move(t.x - player.state.x, t.z - player.state.z, 0.1);
    maxSlope = Math.max(maxSlope, player.state.slope);
    maxPlayerGroundError = Math.max(
      maxPlayerGroundError,
      Math.abs(
        player.state.y - getTerrainHeight(player.state.x, player.state.z),
      ),
    );
    if (player.state.blocked) break;
  }
  trace.push({ ...player.state });
  if (player.state.blocked) break;
}
const beach = data.landuse.features.find((f) => f.id === "way/836480414")!;
const route = {
  source:
    "OSM way/1546274171; last 21m unmapped link to beach interior, not verified entrance",
  points: QA_ROUTE,
  trace,
  passed:
    !player.state.blocked &&
    contains(beach.geometry, player.state.longitude, player.state.latitude),
  maxSlope,
  maxPlayerGroundError,
};
const terrainAudit = {
  rawDem: "Copernicus GLO-30; bilinear native-cell interpolation",
  rendered:
    "Regular 10m-cell DEM surface clipped to coast; shared spatial triangle index and barycentric interpolation for roads/buildings/player; no synthetic detail",
  verticalScale: 1,
};
const geography = await read("data/dongao/geography-audit.json");
const qa = {
  ...geography,
  terrain: terrainAudit,
  roads: roadAudit,
  buildings: {
    count: data.buildings.features.length,
    footCount,
    maxBaseErrorMeters: maxBaseError,
    minRoofClearanceMeters: minRoofClearance,
    height:
      "Uniform provisional 6m above highest footprint terrain, bottom follows terrain every <=2m",
  },
  roadRender: {
    checked,
    worstRoadPoint,
    maxRoadMeshGapMeters: maxRoadMeshGap,
    maxBurialMeters: maxBurial,
    note: "Non-bridge triangles only; bridges use explicitly unverified deck profile",
  },
  route,
  readyForGameplay: false,
};
await writeFile(
  "data/dongao/geography-audit.json",
  JSON.stringify(qa, null, 2),
);
const report = {
  ...data.report,
  status: "geography-qa-incomplete",
  qa,
  acceptance: {
    dem: true,
    buildingDistribution: "present-but-not-survey-validated",
    independentReference: "Sentinel-2 coarse-only",
    amapRegistration: false,
    roadWaterConflict: "unresolved",
    playerRoute: route.passed,
    realDevices: false,
    readyForGameplay: false,
  },
};
await writeFile(
  "data/dongao/quality-report.json",
  JSON.stringify(report, null, 2),
);
await copyFile(
  "data/dongao/quality-report.json",
  "public/data/dongao/quality-report.json",
);
await writeFile(
  "data/dongao/road-audit.json",
  JSON.stringify(roadAudit, null, 2),
);
await writeFile(
  "public/data/dongao/world.json",
  JSON.stringify({ ...data, report }),
);
console.log(
  JSON.stringify(
    {
      roads: roadAudit.byIssue,
      buildings: qa.buildings,
      roadRender: qa.roadRender,
      route: {
        passed: route.passed,
        length: player.state.distance,
        maxSlope,
        maxPlayerGroundError,
      },
    },
    null,
    2,
  ),
);
