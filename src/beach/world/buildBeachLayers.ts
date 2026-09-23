import * as THREE from "three";
import type { FeatureCollection } from "geojson";
import type { BeachWorldData } from "../data/types";
import { geoToWorld } from "../../game/geo/coordinates";
import { buildBuildings } from "../../game/world/buildings";
import { addMerged, lines, surface } from "../../game/world/geometry";
import { buildRoads } from "../../game/world/roads";
import {
  configureTerrain,
  getTerrainHeight,
  installTerrainSurface,
  queryTerrain,
} from "../../game/world/terrain";

export type BeachLayerId =
  | "terrain"
  | "ocean"
  | "landuse"
  | "beach"
  | "roads"
  | "buildings"
  | "coastline"
  | "pois"
  | "geoOverlay";

export type BeachLayerVisibility = Record<BeachLayerId, boolean>;

export const DEFAULT_BEACH_LAYERS: BeachLayerVisibility = {
  terrain: true,
  ocean: true,
  landuse: true,
  beach: true,
  roads: true,
  buildings: true,
  coastline: true,
  pois: true,
  geoOverlay: true,
};

function boundary(bbox: readonly number[], color: string) {
  const corners = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[2], bbox[3]],
    [bbox[0], bbox[3]],
  ];
  const points: THREE.Vector3[] = [];
  for (let edge = 0; edge < corners.length; edge++) {
    const start = corners[edge];
    const end = corners[(edge + 1) % corners.length];
    for (let step = 0; step < 40; step++) {
      const t = step / 40;
      const longitude = start[0] + (end[0] - start[0]) * t;
      const latitude = start[1] + (end[1] - start[1]) * t;
      const point = geoToWorld(latitude, longitude);
      points.push(
        new THREE.Vector3(
          point.x,
          (queryTerrain(point.x, point.z).rendered ?? 0) + 1.4,
          point.z,
        ),
      );
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points,
  );
  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 20;
  return line;
}

function drapedLayer(data: FeatureCollection, color: string, offset: number) {
  const group = new THREE.Group();
  addMerged(
    group,
    data.features.flatMap((feature) =>
      surface(feature.geometry, offset, true),
    ),
    color,
  );
  return group;
}

export function buildBeachLayers(data: BeachWorldData) {
  configureTerrain(data.dem, data.land, data.water);
  if (!data.terrainPositions) throw new Error("沙滩 DEM 渲染网格缺失");
  const root = new THREE.Group();
  const terrain = new THREE.Group();
  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.terrainPositions, 3),
  );
  terrainGeometry.computeVertexNormals();
  const position = terrainGeometry.getAttribute("position");
  const colorValues: number[] = [];
  for (let index = 0; index < position.count; index++) {
    const height = position.getY(index);
    const color = new THREE.Color().setHSL(
      0.31 - Math.min(Math.max(height, 0) / 100, 1) * 0.17,
      0.34,
      0.64 - Math.min(Math.max(height, 0) / 120, 1) * 0.2,
    );
    colorValues.push(color.r, color.g, color.b);
  }
  terrainGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colorValues, 3),
  );
  terrain.add(
    new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
    ),
  );
  installTerrainSurface(data.terrainPositions);

  const ocean = new THREE.Group();
  addMerged(
    ocean,
    data.sea.features.flatMap((feature) => surface(feature.geometry, -0.12)),
    "#77afbd",
  );
  const beach = drapedLayer(data.beach, "#e9cb80", 0.1);
  const otherLanduse: FeatureCollection = {
    type: "FeatureCollection",
    features: data.landuse.features.filter(
      (feature) => !data.beach.features.some((item) => item.id === feature.id),
    ),
  };
  const landuse = drapedLayer(otherLanduse, "#aabf9e", 0.06);
  const roads = buildRoads(data.roads);
  const buildings = buildBuildings(data.buildings);

  const coastline = new THREE.Group();
  const coastPositions: number[] = [];
  for (const feature of data.coastline.features)
    for (const line of lines(feature.geometry))
      for (let index = 1; index < line.length; index++)
        for (const point of [line[index - 1], line[index]]) {
          const world = geoToWorld(point[1], point[0]);
          coastPositions.push(
            world.x,
            getTerrainHeight(world.x, world.z) + 0.32,
            world.z,
          );
        }
  const coastGeometry = new THREE.BufferGeometry();
  coastGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(coastPositions, 3),
  );
  coastline.add(
    new THREE.LineSegments(
      coastGeometry,
      new THREE.LineBasicMaterial({ color: "#13647a" }),
    ),
  );

  const pois = new THREE.Group();
  const poiMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(2.3, 2.3, 1, 10),
    new THREE.MeshBasicMaterial({ color: "#bf4b36" }),
    data.pois.length,
  );
  data.pois.forEach((poi, index) => {
    const world = geoToWorld(poi.latitude, poi.longitude);
    poiMesh.setMatrixAt(
      index,
      new THREE.Matrix4().makeTranslation(
        world.x,
        getTerrainHeight(world.x, world.z) + 1.2,
        world.z,
      ),
    );
  });
  pois.add(poiMesh);

  const geoOverlay = new THREE.Group();
  geoOverlay.add(
    boundary(data.slice.bufferBbox, "#1686a0"),
    boundary(data.slice.coreBbox, "#d63b68"),
  );

  const layers = {
    terrain,
    ocean,
    landuse,
    beach,
    roads,
    buildings,
    coastline,
    pois,
    geoOverlay,
  } satisfies Record<BeachLayerId, THREE.Group>;
  root.add(...Object.values(layers));
  return { root, layers };
}
