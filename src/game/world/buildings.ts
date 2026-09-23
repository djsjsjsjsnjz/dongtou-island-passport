import * as THREE from "three";
import type { FeatureCollection } from "geojson";
import { addMerged, shapes } from "./geometry";
import { getTerrainHeight } from "./terrain";
export function buildingHeight(
  id: string,
  properties: Record<string, unknown>,
): number {
  const height = Number.parseFloat(String(properties.height ?? ""));
  if (Number.isFinite(height) && height > 0) return Math.min(height, 100);
  const levels = Number(properties["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * 3, 100);
  const hash = Array.from(id).reduce(
    (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
    0,
  );
  return 4 + (hash % 9); // illustrative scale only, never a claimed measurement
}
export function buildBuildings(data: FeatureCollection) {
  const group = new THREE.Group(),
    geometries: THREE.BufferGeometry[] = [];
  for (const f of data.features)
    for (const s of shapes(f.geometry)) {
      const g = new THREE.ExtrudeGeometry(s, {
        depth: buildingHeight(String(f.id), f.properties || {}),
        bevelEnabled: false,
        steps: 1,
      });
      g.rotateX(-Math.PI / 2);
      g.computeBoundingBox();
      const c = g.boundingBox!.getCenter(new THREE.Vector3());
      g.translate(0, getTerrainHeight(c.x, c.z) + 0.3, 0);
      geometries.push(g);
    }
  addMerged(group, geometries, "#b37861");
  return group;
}
