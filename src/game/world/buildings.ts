import * as THREE from "three";
import type { FeatureCollection } from "geojson";
import { addMerged, shapes } from "./geometry";
import { getTerrainHeight } from "./terrain";
export function buildingHeight(
  _id: string,
  properties: Record<string, unknown>,
): number {
  const h = Number.parseFloat(String(properties.height ?? ""));
  if (Number.isFinite(h) && h > 0) return Math.min(h, 100);
  const levels = Number(properties["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * 3, 100);
  return 6; // Uniform provisional height. NOT a measurement or inferred floor count.
}
export function buildBuildings(data: FeatureCollection) {
  const group = new THREE.Group(),
    geometries: THREE.BufferGeometry[] = [];
  for (const f of data.features)
    for (const s of shapes(f.geometry)) {
      const height = buildingHeight(String(f.id), f.properties || {});
      // Densify walls at <=2m; bottom vertices use precisely the shared terrain sampler.
      const densify = (path: THREE.Path) => {
        const points = path.getPoints(),
          out: THREE.Vector2[] = [];
        for (let i = 0; i < points.length; i++) {
          const a = points[i],
            b = points[(i + 1) % points.length],
            n = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
          for (let j = 0; j < n; j++) out.push(a.clone().lerp(b, j / n));
        }
        return out;
      };
      const shape = new THREE.Shape(densify(s));
      shape.holes = s.holes.map((h) => new THREE.Path(densify(h)));
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
        steps: 1,
      });
      g.rotateX(-Math.PI / 2);
      const cache = new Map<string, number>();
      const ground = (x: number, z: number) => {
        const key = `${x},${z}`;
        let value = cache.get(key);
        if (value === undefined) {
          value = getTerrainHeight(x, z);
          cache.set(key, value);
        }
        return value;
      };
      const a = g.getAttribute("position");
      let roof = 0;
      for (let i = 0; i < a.count; i++)
        roof = Math.max(roof, ground(a.getX(i), a.getZ(i)) + height);
      for (let i = 0; i < a.count; i++)
        a.setY(
          i,
          a.getY(i) > height / 2 ? roof : ground(a.getX(i), a.getZ(i)) - 0.05,
        );
      a.needsUpdate = true;
      g.computeVertexNormals();
      geometries.push(g);
    }
  addMerged(group, geometries, "#b37861");
  return group;
}
