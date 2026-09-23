import type { WorldData } from "../data/types";
import { geoToWorld, worldToGeo } from "../geo/coordinates";
import { contains, queryTerrain, slopeAt } from "./terrain";
import { closestRoad, roadSegments } from "./roads";
export const SPAWN = {
  longitude: 121.15599415965787,
  latitude: 27.825667736962423,
};
export const MAX_SLOPE = 35,
  PLAYER_RADIUS = 0.55,
  PLAYER_SPEED = 3.2;
export type PlayerState = {
  x: number;
  z: number;
  y: number;
  raw: number | null;
  slope: number;
  road: string;
  blocked: string;
  distance: number;
  longitude: number;
  latitude: number;
};
export function createPlayer(data: WorldData) {
  const roads = roadSegments(data.roads),
    start = geoToWorld(SPAWN.latitude, SPAWN.longitude);
  // Preproject collision polygons once, retaining holes and all real footprints.
  const buildings = data.buildings.features.map((f) => {
    const g = structuredClone(f.geometry);
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      const ps = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      for (const rings of ps)
        for (const r of rings)
          for (const p of r) {
            const v = geoToWorld(p[1], p[0]);
            p[0] = v.x;
            p[1] = v.z;
          }
    }
    return g;
  });
  const cells = new Map<string, typeof buildings>();
  for (const g of buildings) {
    const rings =
      g.type === "Polygon"
        ? g.coordinates
        : g.type === "MultiPolygon"
          ? g.coordinates.flat()
          : [];
    const pts = rings.flat();
    const xs = pts.map((p) => p[0]),
      zs = pts.map((p) => p[1]);
    for (
      let cx = Math.floor(Math.min(...xs) / 25);
      cx <= Math.floor(Math.max(...xs) / 25);
      cx++
    )
      for (
        let cz = Math.floor(Math.min(...zs) / 25);
        cz <= Math.floor(Math.max(...zs) / 25);
        cz++
      ) {
        const key = `${cx},${cz}`,
          items = cells.get(key) || [];
        items.push(g);
        cells.set(key, items);
      }
  }
  const state: PlayerState = {
    ...start,
    ...SPAWN,
    y: 0,
    raw: null,
    slope: 0,
    road: "",
    blocked: "",
    distance: 0,
  };
  function sample(x: number, z: number) {
    const q = queryTerrain(x, z),
      near = closestRoad(x, z, roads),
      road = near && near.distance <= near.segment.width / 2 ? near : null;
    return {
      q,
      road,
      y: road?.segment.bridge ? road.y : q.rendered,
      slope: road?.segment.bridge
        ? (Math.atan2(
            Math.abs(road.segment.b.y - road.segment.a.y),
            Math.hypot(
              road.segment.b.x - road.segment.a.x,
              road.segment.b.z - road.segment.a.z,
            ),
          ) *
            180) /
          Math.PI
        : slopeAt(x, z),
    };
  }
  function obstacle(x: number, z: number) {
    // A swept disc is approximated conservatively by center + 16 perimeter samples; substeps <= .2m.
    for (let i = -1; i < 16; i++) {
      const px = x + (i < 0 ? 0 : Math.cos((i * Math.PI) / 8) * PLAYER_RADIUS),
        pz = z + (i < 0 ? 0 : Math.sin((i * Math.PI) / 8) * PLAYER_RADIUS);
      if (
        cells
          .get(`${Math.floor(px / 25)},${Math.floor(pz / 25)}`)
          ?.some((g) => contains(g, px, pz))
      )
        return "建筑碰撞";
      const q = queryTerrain(px, pz);
      if (!q.inBounds || q.rendered === null) return "边界 / DEM 缺失";
      if (!q.onLand || q.onWater) {
        const r = closestRoad(px, pz, roads);
        if (
          !r?.segment.bridge ||
          r.distance > r.segment.width / 2 - PLAYER_RADIUS
        )
          return "海域 / 水体";
      }
    }
    return "";
  }
  function update() {
    const t = sample(state.x, state.z);
    state.y = t.y ?? 0;
    state.raw = t.q.raw;
    state.slope = t.slope;
    state.road = t.road
      ? `${t.road.segment.name} (${t.road.segment.id})`
      : "非道路";
    Object.assign(state, worldToGeo(state.x, state.z));
  }
  function move(dx: number, dz: number, dt: number) {
    const len = Math.hypot(dx, dz);
    if (!len) return state;
    const dist =
        Math.min(0.1, Math.max(0, dt)) * PLAYER_SPEED * Math.min(1, len),
      n = Math.max(1, Math.ceil(dist / 0.2));
    state.blocked = "";
    for (let i = 0; i < n; i++) {
      const x = state.x + ((dx / len) * dist) / n,
        z = state.z + ((dz / len) * dist) / n,
        t = sample(x, z);
      const blocked =
        obstacle(x, z) ||
        (t.road?.segment.tunnel
          ? "隧道未建纵断面"
          : t.slope > MAX_SLOPE
            ? "坡度超过 35°"
            : Math.abs((t.y ?? Infinity) - state.y) >
                (Math.tan((MAX_SLOPE * Math.PI) / 180) * dist) / n + 0.08
              ? "断崖 / 高差"
              : "");
      if (blocked) {
        state.blocked = blocked;
        break;
      }
      state.x = x;
      state.z = z;
      state.distance += dist / n;
      update();
    }
    return state;
  }
  update();
  const initialBlock = obstacle(state.x, state.z);
  if (initialBlock) throw new Error(`出生点不可行走：${initialBlock}`);
  return {
    state,
    move,
    roads,
    reset() {
      Object.assign(state, start, { distance: 0, blocked: "" });
      update();
    },
  };
}
