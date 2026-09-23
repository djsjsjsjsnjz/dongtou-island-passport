import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export async function readJson<T = any>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8"));
}
export async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    `${path}.tmp`,
    JSON.stringify(
      value,
      null,
      path.endsWith(".geojson") || path.endsWith("world.json") ? undefined : 2,
    ) + "\n",
  );
  await rename(`${path}.tmp`, path);
}
