/** STEP 4 inspection plane only. No DEM or fabricated elevation. */
export const terrainStatus = { mode: "flat-review" as const, hasDem: false };
export function getTerrainHeight(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z))
    throw new Error("Invalid terrain query");
  return 0;
}
