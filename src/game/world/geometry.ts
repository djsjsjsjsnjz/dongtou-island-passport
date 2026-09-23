import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Geometry, Position } from "geojson";
import { drapeConvexPolygon } from "./terrain";
import { geoToWorld } from "../geo/coordinates";
export function toVector(p: Position) {
  const { x, z } = geoToWorld(p[1], p[0]);
  return new THREE.Vector2(x, -z);
}
export function shapes(g: Geometry): THREE.Shape[] {
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return [];
  return (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map(
    (rings) => {
      const shape = new THREE.Shape(rings[0].map(toVector));
      shape.holes = rings.slice(1).map((r) => new THREE.Path(r.map(toVector)));
      return shape;
    },
  );
}
export function lines(g: Geometry): Position[][] {
  return g.type === "LineString"
    ? [g.coordinates]
    : g.type === "MultiLineString"
      ? g.coordinates
      : [];
}
export function surface(g: Geometry, y: number, drape = false, _maxEdge = 16) {
  return shapes(g).map((s) => {
    const geo = new THREE.ShapeGeometry(s);
    geo.rotateX(-Math.PI / 2);
    if (!drape) {
      geo.translate(0, y, 0);
      return geo;
    }
    const raw = geo.toNonIndexed(),
      a = raw.getAttribute("position"),
      vertices: number[] = [];
    for (let i = 0; i < a.count; i += 3) {
      const v = drapeConvexPolygon(
        [
          [a.getX(i), a.getZ(i)],
          [a.getX(i + 1), a.getZ(i + 1)],
          [a.getX(i + 2), a.getZ(i + 2)],
        ],
        y,
      );
      for (const n of v) vertices.push(n);
    }
    raw.dispose();
    geo.dispose();
    const result = new THREE.BufferGeometry();
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    result.computeVertexNormals();
    result.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        new Float32Array((vertices.length / 3) * 2),
        2,
      ),
    );
    return result;
  });
}
export function addMerged(
  parent: THREE.Group,
  geometries: THREE.BufferGeometry[],
  color: string,
) {
  if (!geometries.length) return;
  const normalized = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(normalized, false);
  new Set([...geometries, ...normalized]).forEach((g) => g.dispose());
  if (!merged) throw new Error("Unable to merge map geometry");
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
  );
  parent.add(mesh);
}
