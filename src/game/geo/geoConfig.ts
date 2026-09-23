import config from "../../../data/dongao/config.json";
import type { GeoConfig } from "./geoTypes";
export const GEO_CONFIG: GeoConfig = {
  ...config,
  bbox: [config.bbox[0], config.bbox[1], config.bbox[2], config.bbox[3]],
};
