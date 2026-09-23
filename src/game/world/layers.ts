import * as THREE from "three";
import type { WorldData } from "../data/types";
import { addMerged, surface, lines } from "./geometry";
import { buildRoads } from "./roads";
import { buildBuildings } from "./buildings";
import { configureTerrain, installTerrainSurface } from "./terrain";
import { GEO_CONFIG } from "../geo/geoConfig";
import controlsData from "../../../data/dongao/controls.json";
import { getTerrainHeight } from "./terrain";
import { geoToWorld } from "../geo/coordinates";
import { publicDataUrl } from "../data/publicUrl";
export type LayerId =
  | "buildings"
  | "roads"
  | "coastline"
  | "landuse"
  | "pois"
  | "grid"
  | "dem"
  | "elevation"
  | "roadTypes"
  | "anomalies"
  | "controls"
  | "reference";
export type LayerVisibility = Record<LayerId, boolean>;
export const DEFAULT_LAYERS: LayerVisibility = {
  buildings: true,
  roads: true,
  coastline: true,
  landuse: true,
  pois: true,
  grid: false,
  dem: true,
  elevation: false,
  roadTypes: false,
  anomalies: false,
  controls: false,
  reference: false,
};
export function buildWorldLayers(data: WorldData) {
  configureTerrain(data.dem, data.land, data.water);
  const root = new THREE.Group();
  const land = new THREE.Group(),
    sea = new THREE.Group(),
    water = new THREE.Group(),
    landuse = new THREE.Group(),
    coastline = new THREE.Group(),
    pois = new THREE.Group();
  if (!data.terrainPositions) throw new Error("DEM 渲染网格缺失");
  const landGeometry = new THREE.BufferGeometry();
  landGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.terrainPositions, 3),
  );
  landGeometry.computeVertexNormals();
  land.add(
    new THREE.Mesh(
      landGeometry,
      new THREE.MeshLambertMaterial({
        color: "#c8d3bb",
        side: THREE.DoubleSide,
      }),
    ),
  );
  installTerrainSurface(data.terrainPositions);
  addMerged(
    sea,
    data.sea.features.flatMap((f) => surface(f.geometry, -0.15)),
    "#7fb8c5",
  );
  addMerged(
    water,
    data.water.features.flatMap((f) => surface(f.geometry, 0.12, true)),
    "#7fb8c5",
  );
  const colors: Record<string, string> = {
    beach: "#edcf8a",
    wood: "#a9c09b",
    scrub: "#b5c9a5",
    residential: "#dacbb3",
    industrial: "#c4bdba",
  };
  // Clip the original land-use polygons against terrain faces: preserve true plan boundaries.
  const landuseBuckets = new Map<string, THREE.BufferGeometry[]>();
  for (const f of data.landuse.features) {
    const p = f.properties || {},
      color = colors[p.natural || p.landuse] || "#c5c8ad",
      list = landuseBuckets.get(color) || [];
    list.push(...surface(f.geometry, 0.06, true));
    landuseBuckets.set(color, list);
  }
  for (const [color, geometries] of landuseBuckets)
    addMerged(landuse, geometries, color);
  const coastPositions: number[] = [];
  for (const f of data.coastline.features)
    for (const line of lines(f.geometry))
      for (let i = 1; i < line.length; i++) {
        for (const p of [line[i - 1], line[i]]) {
          const { x, z } = geoToWorld(p[1], p[0]);
          coastPositions.push(x, getTerrainHeight(x, z) + 0.3, z);
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
    poiMesh.setMatrixAt(
      i,
      new THREE.Matrix4().makeTranslation(x, getTerrainHeight(x, z) + 1, z),
    );
  });
  pois.add(poiMesh);
  const grid = new THREE.Group();
  const helper = new THREE.GridHelper(2000, 20, "#526c68", "#8fa29b");
  helper.position.y = 130;
  (helper.material as THREE.Material).depthTest = false;
  (helper.material as THREE.Material).transparent = true;
  (helper.material as THREE.Material).opacity = 0.45;
  grid.add(helper);
  const elevation = land.clone();
  elevation.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry = o.geometry.clone();
      const a = o.geometry.getAttribute("position"),
        colors: number[] = [];
      for (let i = 0; i < a.count; i++) {
        const c = new THREE.Color().setHSL(
          0.35 - Math.min(a.getY(i) / 130, 1) * 0.3,
          0.48,
          0.48,
        );
        colors.push(c.r, c.g, c.b);
      }
      o.geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      o.material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: -1,
      });
    }
  });
  const controls = new THREE.Group(),
    reference = new THREE.Group();
  if (import.meta.env.DEV) {
    const positions: number[] = [];
    const intersections =
      (
        data.report as unknown as {
          qa?: { roadIntersections?: { coordinate: number[] }[] };
        }
      ).qa?.roadIntersections || [];
    for (const node of intersections) {
      const p = geoToWorld(node.coordinate[1], node.coordinate[0]);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 4, 3),
        new THREE.MeshBasicMaterial({ color: "#146fdf", depthTest: false }),
      );
      dot.position.set(p.x, 135, p.z);
      controls.add(dot);
    }
    for (const p of controlsData) {
      const original = "reference" in p ? p.reference : p.osm;
      if (!original) continue;
      const a = geoToWorld(original[1], original[0]),
        b = geoToWorld(p.adopted[1], p.adopted[0]);
      positions.push(a.x, 135, a.z, b.x, 135, b.z);
      for (const [q, color] of [
        [a, "#bf28a7"],
        [b, "#146fdf"],
      ] as const) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(4, 6, 4),
          new THREE.MeshBasicMaterial({ color, depthTest: false }),
        );
        dot.position.set(q.x, 135, q.z);
        controls.add(dot);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    controls.add(
      new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: "#d52078", depthTest: false }),
      ),
    );
    const b = GEO_CONFIG.bbox,
      sw = geoToWorld(b[1], b[0]),
      ne = geoToWorld(b[3], b[2]);
    const texture = new THREE.TextureLoader().load(
      publicDataUrl("dongao/reference/sentinel-20250320.png"),
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.PlaneGeometry(ne.x - sw.x, sw.z - ne.z);
    plane.rotateX(-Math.PI / 2);
    const overlay = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
      }),
    );
    overlay.position.set((ne.x + sw.x) / 2, 140, (ne.z + sw.z) / 2);
    overlay.renderOrder = 10;
    reference.add(overlay);
  }
  const layers = {
    reference,
    dem: land,
    elevation,
    roadTypes: buildRoads(data.roads, true),
    anomalies: buildRoads(data.roads, false, true),
    controls,
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
    elevation,
    layers.roadTypes,
    layers.anomalies,
    controls,
    reference,
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
  materials.forEach((m) => {
    if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose();
    m.dispose();
  });
}
