import polygonClipping from "polygon-clipping";
import type {
  Feature,
  Geometry,
  Position,
  Polygon,
  MultiPolygon,
  FeatureCollection,
} from "geojson";
import type { BoundingBox } from "../../src/game/geo/geoTypes";

export function rectangle(b: BoundingBox): Position[][] {
  return [
    [
      [b[0], b[1]],
      [b[2], b[1]],
      [b[2], b[3]],
      [b[0], b[3]],
      [b[0], b[1]],
    ],
  ];
}
export function polygons(g: Polygon | MultiPolygon): Position[][][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}
export function inRing(p: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function inPolygon(p: Position, rings: Position[][]) {
  return inRing(p, rings[0]) && !rings.slice(1).some((r) => inRing(p, r));
}

/** Liang-Barsky clipping: preserve line order and never connect across off-map excursions. */
export function clipLine(points: Position[], b: BoundingBox): Position[][] {
  const parts: Position[][] = [];
  let active: Position[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      end = points[i],
      dx = end[0] - a[0],
      dy = end[1] - a[1];
    let t0 = 0,
      t1 = 1,
      valid = true;
    const p = [-dx, dx, -dy, dy],
      q = [a[0] - b[0], b[2] - a[0], a[1] - b[1], b[3] - a[1]];
    for (let k = 0; k < 4; k++) {
      if (p[k] === 0) {
        if (q[k] < 0) valid = false;
      } else {
        const t = q[k] / p[k];
        if (p[k] < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!valid || t0 >= t1) {
      active = [];
      continue;
    }
    const start = [a[0] + t0 * dx, a[1] + t0 * dy],
      stop = [a[0] + t1 * dx, a[1] + t1 * dy];
    if (
      !active.length ||
      Math.hypot(active.at(-1)![0] - start[0], active.at(-1)![1] - start[1]) >
        1e-10
    ) {
      active = [start];
      parts.push(active);
    }
    active.push(stop);
  }
  return parts;
}
export function clipFeature(f: Feature, bbox: BoundingBox): Feature | null {
  const g = f.geometry;
  let geometry: Geometry;
  if (g.type === "Point") {
    const [x, y] = g.coordinates;
    if (x < bbox[0] || x > bbox[2] || y < bbox[1] || y > bbox[3]) return null;
    geometry = g;
  } else if (g.type === "Polygon" || g.type === "MultiPolygon") {
    const clipped = polygonClipping.intersection(
      g.coordinates as any,
      rectangle(bbox) as any,
    );
    if (!clipped.length) return null;
    geometry = { type: "MultiPolygon", coordinates: clipped };
  } else if (g.type === "LineString" || g.type === "MultiLineString") {
    const lines = (
      g.type === "LineString" ? [g.coordinates] : g.coordinates
    ).flatMap((p) => clipLine(p, bbox));
    if (!lines.length) return null;
    geometry = { type: "MultiLineString", coordinates: lines };
  } else return null;
  return { ...f, geometry };
}
export const collection = (features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});
export function representativePoint(g: Geometry): Position | null {
  if (g.type === "Point") return g.coordinates;
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return null;
  let best: Position | null = null,
    width = 0;
  // Interior point of the longest horizontal span, respecting holes.
  for (const poly of polygons(g)) {
    const ys = poly[0].map((p) => p[1]);
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const xs: number[] = [];
    for (const ring of poly)
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1],
          b = ring[i];
        if (a[1] > y !== b[1] > y)
          xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 2)
      if (xs[i] - xs[i - 1] > width) {
        width = xs[i] - xs[i - 1];
        best = [(xs[i] + xs[i - 1]) / 2, y];
      }
  }
  return best;
}

/** Use complete OSM island relations or complete directed closed coastline ways.
 * Fail on missing coverage rather than closing open coastlines with an invented chord. */
export function makeLand(
  all: FeatureCollection,
  coastline: FeatureCollection,
  bbox: BoundingBox,
) {
  const candidates: (Polygon | MultiPolygon)[] = [];
  for (const f of all.features) {
    const p = f.properties || {},
      g = f.geometry;
    if (
      p.place === "island" &&
      (g.type === "Polygon" || g.type === "MultiPolygon")
    )
      candidates.push(g);
    if (p.natural === "coastline" && g.type === "LineString") {
      const r = g.coordinates;
      if (r.length > 3 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1])
        candidates.push({ type: "Polygon", coordinates: [r] });
    }
  }
  if (!candidates.length)
    throw new Error(
      "No complete island polygon. Import a licensed land polygon extract; do not guess open coastline closure.",
    );
  const clipped = candidates.flatMap((g) =>
    polygonClipping.intersection(g.coordinates as any, rectangle(bbox) as any),
  );
  const land = polygonClipping.union(...(clipped as [any, ...any[]]));
  // Every coastline point must sit on a resulting land boundary (roughly <0.1 m).
  const rings = land.flat();
  const distance = (p: Position, a: Position, b: Position) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      den = dx * dx + dy * dy;
    const t = den
      ? Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den),
        )
      : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  for (const f of coastline.features) {
    const g = f.geometry;
    const lines =
      g.type === "MultiLineString"
        ? g.coordinates
        : g.type === "LineString"
          ? [g.coordinates]
          : [];
    for (const p of lines.flat())
      if (
        !rings.some((r) =>
          r.slice(1).some((v, i) => distance(p, r[i], v) < 1e-6),
        )
      )
        throw new Error(
          "Coastline has no matching complete land boundary; stop and review source coverage.",
        );
  }
  const sea = polygonClipping.difference(rectangle(bbox) as any, land);
  return {
    land: collection([
      {
        type: "Feature",
        properties: { source: "OSM complete island boundaries" },
        geometry: { type: "MultiPolygon", coordinates: land },
      },
    ]),
    sea: collection([
      {
        type: "Feature",
        properties: { source: "bbox minus OSM land" },
        geometry: { type: "MultiPolygon", coordinates: sea },
      },
    ]),
  };
}
