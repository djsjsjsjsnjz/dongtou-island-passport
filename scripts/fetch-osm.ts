import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { GEO_CONFIG } from "../src/game/geo/geoConfig";
import { validateBounds } from "../src/game/geo/coordinates";
import { readJson, writeJson } from "./lib/io";

const base = "data/dongao";
const config = await readJson(`${base}/config.json`);
validateBounds(config.bbox);
const args = process.argv.slice(2);
if (args.some((a) => a !== "--refresh"))
  throw new Error(
    "Usage: npm run geo:fetch [-- --refresh]. Set bbox in data/dongao/config.json.",
  );
let cached = false;
try {
  await access(`${base}/osm.raw.json`);
  cached = true;
} catch {
  /* first fetch */
}
if (cached && !args.includes("--refresh")) {
  const metadata = await readJson(`${base}/fetch-manifest.json`);
  if (JSON.stringify(metadata.bbox) !== JSON.stringify(config.bbox))
    throw new Error("Cached bbox differs. Use --refresh explicitly.");
  console.log("Using cached OSM. No network request. Run npm run geo:process.");
} else {
  // Read only this non-secret endpoint from .env.local; never log or send API keys.
  const env = await readFile(".env.local", "utf8").catch(() => "");
  const configured = env.match(/^OVERPASS_URL=(.+)$/m)?.[1]?.trim();
  const endpoint =
    process.env.OVERPASS_URL ||
    configured ||
    "https://overpass-api.de/api/interpreter";
  if (new URL(endpoint).protocol !== "https:")
    throw new Error("Overpass endpoint must use HTTPS");
  const [w, s, e, n] = config.bbox;
  const b = `(${s},${w},${n},${e})`;
  const filters = [
    "[highway]",
    "[building]",
    '[natural~"coastline|water|beach|wood|scrub"]',
    "[waterway]",
    "[landuse]",
    "[tourism]",
    "[amenity]",
    "[historic]",
    "[place]",
  ];
  // Full geometry is needed for island relations. Only the bbox is published/rendered.
  const query = `[out:json][timeout:60];(${filters.map((f) => `nwr${f}${b};`).join("")});out body geom;`;
  // curl also honors system HTTPS proxies; arguments never pass through a shell.
  const response = spawnSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      "90",
      "-A",
      "DongaoMapPrototype/0.1 (https://github.com/djsjsjsjsnjz/dongtou-island-passport)",
      "--data-urlencode",
      `data=${query}`,
      endpoint,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (response.status !== 0)
    throw new Error(
      "OSM download failed; cache was preserved. Check connectivity/endpoint and retry later.",
    );
  const data = JSON.parse(response.stdout);
  if (data.remark || !Array.isArray(data.elements) || !data.elements.length)
    throw new Error(
      `Incomplete OSM response; cache preserved: ${data.remark || "empty response"}`,
    );
  await writeJson(`${base}/osm.raw.json`, data);
  await writeJson(`${base}/fetch-manifest.json`, {
    source: "OpenStreetMap contributors",
    license: "ODbL-1.0",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    endpoint,
    retrievedAt: new Date().toISOString(),
    osmTimestamp: data.osm3s.timestamp_osm_base,
    bbox: config.bbox,
    center: GEO_CONFIG.center,
    query,
  });
  console.log(
    `Cached ${data.elements.length} OSM objects. Run npm run geo:process.`,
  );
}
