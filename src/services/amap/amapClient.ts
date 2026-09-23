/** Reserved interface only: no key, network calls or unlicensed coordinate conversion. */
export type AmapPoi = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  crs: "GCJ-02";
};
export interface AmapClient {
  search(keyword: string): Promise<AmapPoi[]>;
  geocode(address: string): Promise<AmapPoi[]>;
  reverseGeocode(longitude: number, latitude: number): Promise<AmapPoi[]>;
}
export const amapStatus = {
  enabled: false,
  reason: "等待服务端接入及合法坐标归一化方案",
} as const;
