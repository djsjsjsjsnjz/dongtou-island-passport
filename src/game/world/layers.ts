import * as THREE from "three";
import type { WorldData } from "../data/types";
import { addMerged, surface, lines } from "./geometry";
import { buildRoads } from "./roads";
import { buildBuildings } from "./buildings";
import { geoToWorld } from "../geo/coordinates";
export type LayerId =
  "buildings" | "roads" | "coastline" | "landuse" | "pois" | "grid";
export type LayerVisibility = Record<LayerId, boolean>;
export const DEFAULT_LAYERS: LayerVisibility = {
  buildings: true,
  roads: true,
  coastline: true,
  landuse: true,
  pois: true,
  grid: false,
};
export function buildWorldLayers(data: WorldData) {
  const root = new THREE.Group();
  const land = new THREE.Group(),
    sea = new THREE.Group(),
    water = new THREE.Group(),
    landuse = new THREE.Group(),
    coastline = new THREE.Group(),
    pois = new THREE.Group();
  addMerged(
    land,
    data.land.features.flatMap((f) => surface(f.geometry, 0)),
    "#c8d3bb",
  );
  addMerged(
    sea,
    data.sea.features.flatMap((f) => surface(f.geometry, -0.15)),
    "#7fb8c5",
  );
  addMerged(
    water,
    data.water.features.flatMap((f) => surface(f.geometry, 0.4)),
    "#7fb8c5",
  );
  const colors: Record<string, string> = {
    beach: "#edcf8a",
    wood: "#a9c09b",
    scrub: "#b5c9a5",
    residential: "#dacbb3",
    industrial: "#c4bdba",
  };
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  for (const f of data.landuse.features) {
    const p = f.properties || {},
      color = colors[p.natural || p.landuse] || "#c5c8ad";
    const list = buckets.get(color) || [];
    buckets.set(color, list);
    list.push(...surface(f.geometry, p.natural === "beach" ? 0.35 : 0.15));
  }
  for (const [color, geometries] of buckets)
    addMerged(landuse, geometries, color);
  const coastPositions: number[] = [];
  for (const f of data.coastline.features)
    for (const line of lines(f.geometry))
      for (let i = 1; i < line.length; i++) {
        for (const p of [line[i - 1], line[i]]) {
          const { x, z } = geoToWorld(p[1], p[0]);
          coastPositions.push(x, 0.9, z);
        }
      }
  const coastGeo = new THREE.BufferGeometry();
  coastGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(coastPositions, 3),
  );
  coastline.add(
    new THREE.LineSegments(
      coastGeo,
      new THREE.LineBasicMaterial({ color: "#266b78" }),
    ),
  );
  const poiMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(5, 5, 1, 10),
    new THREE.MeshBasicMaterial({ color: "#b04e33" }),
    data.pois.length,
  );
  data.pois.forEach((p, i) => {
    const { x, z } = geoToWorld(p.latitude, p.longitude);
    poiMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 2, z));
  });
  pois.add(poiMesh);
  const grid = new THREE.Group();
  const helper = new THREE.GridHelper(2000, 20, "#526c68", "#8fa29b");
  helper.position.y = 1.6;
  grid.add(helper);
  const layers = {
    buildings: buildBuildings(data.buildings),
    roads: buildRoads(data.roads),
    coastline,
    landuse,
    pois,
    grid,
  };
  root.add(
    sea,
    land,
    landuse,
    water,
    layers.roads,
    layers.buildings,
    coastline,
    pois,
    grid,
  );
  return { root, layers };
}
export function disposeWorld(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
    if (o instanceof THREE.InstancedMesh) o.dispose();
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
