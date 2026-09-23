export type GeoCoordinate = { latitude: number; longitude: number };
export type WorldCoordinate = { x: number; z: number };
export type BoundingBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];
export type GeoConfig = {
  id: string;
  crs: string;
  center: GeoCoordinate;
  bbox: BoundingBox;
  maxSizeMeters: number;
};
