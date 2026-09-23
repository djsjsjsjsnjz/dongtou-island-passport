import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import polygonClipping from "polygon-clipping";
import * as THREE from "three";
import { geoToWorld, worldToGeo } from "../src/game/geo/coordinates";
import { GEO_CONFIG } from "../src/game/geo/geoConfig";
import { configureTerrain, interpolateDem } from "../src/game/world/terrain";
const read = async (p: string) => JSON.parse(await fs.readFile(p, "utf8"));
const land = await read("data/dongao/land.geojson"),
  dem = await read("data/dongao/dem/heightfield.json");
configureTerrain(dem, land);
const polygons = land.features
  .flatMap((f: any) =>
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates,
  )
  .map((poly: any) =>
    poly.map((ring: any) =>
      ring.map((p: number[]) => {
        const q = geoToWorld(p[1], p[0]);
        return [q.x, q.z];
      }),
    ),
  ) as polygonClipping.MultiPolygon;
const b = GEO_CONFIG.bbox,
  sw = geoToWorld(b[1], b[0]),
  ne = geoToWorld(b[3], b[2]),
  nx = 200,
  nz = 200,
  dx = (ne.x - sw.x) / nx,
  dz = (sw.z - ne.z) / nz,
  positions: number[] = [];
for (let ix = 0; ix < nx; ix++)
  for (let iz = 0; iz < nz; iz++) {
    const x = sw.x + ix * dx,
      z = ne.z + iz * dz,
      x2 = sw.x + (ix + 1) * dx,
      z2 = ne.z + (iz + 1) * dz;
    const clipped = polygonClipping.intersection(polygons, [
      [
        [x, z],
        [x2, z],
        [x2, z2],
        [x, z2],
        [x, z],
      ],
    ]);
    for (const rings of clipped) {
      const cv = (r: number[][]) =>
        r.map((p) => new THREE.Vector2(p[0], -p[1]));
      const s = new THREE.Shape(cv(rings[0]));
      s.holes = rings.slice(1).map((r) => new THREE.Path(cv(r)));
      const indexed = new THREE.ShapeGeometry(s),
        g = indexed.toNonIndexed(),
        a = g.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        const px = a.getX(i),
          pz = -a.getY(i);
        const ll = worldToGeo(px, pz),
          h = interpolateDem(dem, ll.longitude, ll.latitude);
        if (h === null) throw new Error("DEM nodata in land grid");
        positions.push(px, Math.max(0, h), pz);
      }
      g.dispose();
      indexed.dispose();
    }
  }
const buffer = Buffer.from(new Float32Array(positions).buffer);
await fs.writeFile("data/dongao/dem/terrain.f32", buffer);
const manifest = {
  sourceLandSha256: createHash("sha256")
    .update(JSON.stringify(land))
    .digest("hex"),
  sourceHeightfieldSha256: createHash("sha256")
    .update(JSON.stringify(dem))
    .digest("hex"),
  bbox: GEO_CONFIG.bbox,
  center: GEO_CONFIG.center,
  crs: "EPSG:4326",
  worldAxes: "+X east, -Z north, +Y up; metres",
  encoding: "little-endian Float32 non-indexed XYZ triangles",
  bytes: buffer.byteLength,
  sha256: createHash("sha256").update(buffer).digest("hex"),
  triangles: positions.length / 9,
  grid: { nx, nz, dx, dz },
  source:
    "Native Copernicus heightfield bilinear samples at grid and clipped coast vertices",
  method:
    "Regular 10m grid cells intersected with exact OSM land; triangulated per cell. Shared cell boundaries prevent T-junction height cracks. Interpolation adds no source detail.",
};
await fs.writeFile(
  "data/dongao/dem/mesh-manifest.json",
  JSON.stringify(manifest, null, 2),
);
console.log(manifest);
