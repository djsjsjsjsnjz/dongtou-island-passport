import * as THREE from "three";
import type { FeatureCollection } from "geojson";
import { geoToWorld } from "../geo/coordinates";
import {
  drapeConvexPolygon,
  getTerrainHeight,
  queryTerrain,
  isLand,
} from "./terrain";
import { addMerged, lines, surface } from "./geometry";
export const ROAD_WIDTHS: Record<string, number> = {
  primary: 9,
  secondary: 8,
  tertiary: 6,
  residential: 4.5,
  unclassified: 4.5,
  service: 3.5,
  pedestrian: 3,
  footway: 2,
  path: 1.5,
  steps: 1.5,
};
export type RoadPoint = { x: number; z: number; y: number };
export type RoadSegment = {
  a: RoadPoint;
  b: RoadPoint;
  id: string;
  name: string;
  kind: string;
  width: number;
  bridge: boolean;
  tunnel: boolean;
  issues: string[];
};
export function roadSegments(data: FeatureCollection): RoadSegment[] {
  const result: RoadSegment[] = [];
  for (const f of data.features) {
    const p = f.properties || {},
      bridge = !!p.bridge && p.bridge !== "no",
      tunnel = !!p.tunnel && p.tunnel !== "no";
    for (const line of lines(f.geometry)) {
      const pts = line.map((p) => geoToWorld(p[1], p[0]));
      const distances = [0];
      for (let i = 1; i < pts.length; i++)
        distances.push(
          distances[i - 1] +
            Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
        );
      if (pts.length < 2) continue;
      // Bridge deck interpolates its abutments, never each sea sample. No measured clearance is available.
      const start = getTerrainHeight(pts[0].x, pts[0].z),
        end = getTerrainHeight(pts.at(-1)!.x, pts.at(-1)!.z),
        total = distances.at(-1)!;
      const at = (i: number, t: number): RoadPoint => {
        const a = pts[i - 1],
          b = pts[i],
          x = a.x + (b.x - a.x) * t,
          z = a.z + (b.z - a.z) * t;
        const fraction =
          (distances[i - 1] + (distances[i] - distances[i - 1]) * t) / total;
        return {
          x,
          z,
          y:
            (bridge
              ? start + (end - start) * fraction
              : getTerrainHeight(x, z)) + 0.16,
        };
      };
      for (let i = 1; i < pts.length; i++) {
        const steps = Math.max(
          1,
          Math.ceil((distances[i] - distances[i - 1]) / 3),
        );
        for (let j = 0; j < steps; j++) {
          const a = at(i, j / steps),
            b = at(i, (j + 1) / steps),
            issues: string[] = [];
          if (!bridge && !tunnel && (!isLand(a.x, a.z) || !isLand(b.x, b.z)))
            issues.push("non-bridge-water");
          if (
            !bridge &&
            !tunnel &&
            (queryTerrain(a.x, a.z).onWater || queryTerrain(b.x, b.z).onWater)
          )
            issues.push("non-bridge-inland-water");
          if (
            (Math.atan2(Math.abs(b.y - a.y), Math.hypot(b.x - a.x, b.z - a.z)) *
              180) /
              Math.PI >
            35
          )
            issues.push("slope-over-35");
          if (bridge) issues.push("bridge-profile-unverified");
          if (tunnel) issues.push("tunnel-profile-unavailable");
          result.push({
            a,
            b,
            id: String(f.id),
            name: p.name || p.highway,
            kind: p.highway,
            width: ROAD_WIDTHS[p.highway] || 3,
            bridge,
            tunnel,
            issues,
          });
        }
      }
    }
  }
  return result;
}
export function closestRoad(x: number, z: number, segments: RoadSegment[]) {
  let best: {
    segment: RoadSegment;
    distance: number;
    x: number;
    z: number;
    y: number;
  } | null = null;
  for (const s of segments) {
    const dx = s.b.x - s.a.x,
      dz = s.b.z - s.a.z,
      l = dx * dx + dz * dz;
    if (!l) continue;
    const t = Math.max(
      0,
      Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / l),
    );
    const px = s.a.x + t * dx,
      pz = s.a.z + t * dz,
      d = Math.hypot(x - px, z - pz);
    if (!best || d < best.distance)
      best = {
        segment: s,
        distance: d,
        x: px,
        z: pz,
        y: s.a.y + (s.b.y - s.a.y) * t,
      };
  }
  return best;
}
export function buildRoads(
  data: FeatureCollection,
  debug = false,
  anomalies = false,
) {
  const group = new THREE.Group(),
    buckets = new Map<string, THREE.BufferGeometry[]>();
  for (const s of roadSegments(data)) {
    if (s.tunnel && !debug && !anomalies) continue; // No fictitious road across a mountain surface.
    if (anomalies && !s.issues.length) continue;
    const color = anomalies
      ? "#ed284b"
      : debug
        ? s.tunnel
          ? "#a75ae0"
          : s.bridge
            ? "#32bbeb"
            : s.kind === "steps"
              ? "#ed962f"
              : ["path", "footway"].includes(s.kind)
                ? "#50ba6f"
                : "#faf3df"
        : s.bridge
          ? "#e3ecee"
          : "#fff9df";
    const list = buckets.get(color) || [];
    buckets.set(color, list);
    const { a, b } = s,
      dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz);
    if (!len) continue;
    const ox = ((-dz / len) * s.width) / 2,
      oz = ((dx / len) * s.width) / 2;
    const p = [
      [a.x + ox, a.z + oz, a.y],
      [a.x - ox, a.z - oz, a.y],
      [b.x + ox, b.z + oz, b.y],
      [b.x - ox, b.z - oz, b.y],
    ];
    const positions: number[] = s.bridge
      ? []
      : drapeConvexPolygon(
          [p[0], p[1], p[3], p[2]],
          0.16 + (anomalies ? 0.7 : debug ? 0.35 : 0),
        );
    if (s.bridge)
      for (const i of [0, 1, 2, 2, 1, 3]) {
        const [x, z, y] = p[i];
        positions.push(
          x,
          (s.bridge ? y : (queryTerrain(x, z).rendered ?? y) + 0.16) +
            (anomalies ? 0.7 : debug ? 0.35 : 0),
          z,
        );
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    g.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        new Float32Array((positions.length / 3) * 2),
        2,
      ),
    );
    list.push(g);
  }
  if (!debug && !anomalies)
    for (const f of data.features) {
      const list = buckets.get("#fff9df") || [];
      list.push(...surface(f.geometry, 0.16, true, 3));
      buckets.set("#fff9df", list);
    }
  for (const [color, gs] of buckets) addMerged(group, gs, color);
  return group;
}
