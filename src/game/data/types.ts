import type { FeatureCollection } from "geojson";
import type { GeoConfig, GeoCoordinate } from "../geo/geoTypes";
export type Poi = GeoCoordinate & {
  id: string;
  name: string;
  type: string;
  crs: "EPSG:4326";
  sourceUrl: string;
  positionMethod: string;
};
export type WorldData = Record<
  "roads" | "buildings" | "coastline" | "water" | "landuse" | "land" | "sea",
  FeatureCollection
> & {
  pois: Poi[];
  report: {
    schemaVersion: number;
    config: GeoConfig;
    counts: Record<string, number>;
    poiCount: number;
    dimensions: { width: number; depth: number };
    warnings: string[];
    source: { retrievedAt: string; osmTimestamp: string };
    dem: null;
  };
};
