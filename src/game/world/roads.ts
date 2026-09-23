import * as THREE from "three";
import type { FeatureCollection } from "geojson";
import { geoToWorld } from "../geo/coordinates";
import { getTerrainHeight } from "./terrain";
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
export function buildRoads(data: FeatureCollection) {
  const group = new THREE.Group();
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  for (const f of data.features) {
    const p = f.properties || {},
      width = ROAD_WIDTHS[p.highway] || 3;
    const color =
      p.tunnel === "yes"
        ? "#9c9990"
        : ["primary", "secondary", "tertiary"].includes(p.highway)
          ? "#fbf4df"
          : "#fffdf1";
    const geometries = buckets.get(color) || [];
    buckets.set(color, geometries);
    geometries.push(...surface(f.geometry, 0.8));
    for (const line of lines(f.geometry)) {
      const points = line.map((p) => geoToWorld(p[1], p[0]));
      const positions: number[] = [];
      const y = p.bridge === "yes" ? 1.2 : 0.7;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i],
          dx = b.x - a.x,
          dz = b.z - a.z,
          len = Math.hypot(dx, dz);
        if (len < 0.001) continue;
        const ox = ((-dz / len) * width) / 2,
          oz = ((dx / len) * width) / 2,
          ay = getTerrainHeight(a.x, a.z) + y,
          by = getTerrainHeight(b.x, b.z) + y;
        positions.push(
          a.x + ox,
          ay,
          a.z + oz,
          a.x - ox,
          ay,
          a.z - oz,
          b.x + ox,
          by,
          b.z + oz,
          b.x + ox,
          by,
          b.z + oz,
          a.x - ox,
          ay,
          a.z - oz,
          b.x - ox,
          by,
          b.z - oz,
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      g.computeVertexNormals();
      g.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array((positions.length / 3) * 2),
          2,
        ),
      );
      geometries.push(g);
      for (const p of points) {
        const disk = new THREE.CircleGeometry(width / 2, 6);
        disk.rotateX(-Math.PI / 2);
        disk.translate(p.x, getTerrainHeight(p.x, p.z) + y, p.z);
        geometries.push(disk);
      }
    }
  }
  for (const [color, geometries] of buckets)
    addMerged(group, geometries, color);
  return group;
}
