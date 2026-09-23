import type { LayerId, LayerVisibility } from "../world/layers";
import type { MapSample, MapStats } from "../world/MapScene";
import type { PlayerState } from "../world/player";
const labels: Record<LayerId, string> = {
  reference: "卫星对照 55%",
  dem: "DEM 地形",
  elevation: "高程着色",
  roadTypes: "道路类型",
  anomalies: "异常路段",
  controls: "参考控制点",
  buildings: "建筑轮廓",
  roads: "道路",
  coastline: "海岸线",
  landuse: "土地用途 / 沙滩",
  pois: "POI",
  grid: "100 m 坐标网格",
};
export default function DebugPanel({
  visibility,
  onChange,
  sample,
  stats,
  player,
}: {
  visibility: LayerVisibility;
  onChange: (id: LayerId) => void;
  sample: MapSample;
  stats: MapStats | null;
  player: PlayerState | null;
}) {
  return (
    <details className="geo-debug" open>
      <summary>
        地图调试 <small>仅开发环境</small>
      </summary>
      <div className="geo-checks">
        {(Object.keys(labels) as LayerId[]).map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={visibility[id]}
              onChange={() => onChange(id)}
            />
            {labels[id]}
          </label>
        ))}
      </div>
      <p>
        紫点=参考，蓝点=OSM/采用点；误差线见质量报告。卫星原始
        10m，仅用于正北俯视粗配准。
      </p>
      <h3>
        地图游标 <small>高程倍率 1×</small>
      </h3>
      <dl>
        <dt>World X / Z</dt>
        <dd data-testid="world-coordinate">
          {sample.x.toFixed(1)} / {sample.z.toFixed(1)} m
        </dd>
        <dt>Latitude</dt>
        <dd>{sample.latitude.toFixed(7)}</dd>
        <dt>Longitude</dt>
        <dd>{sample.longitude.toFixed(7)}</dd>
        <dt>Terrain Height</dt>
        <dd>{sample.height.toFixed(2)} m · 渲染</dd>
        <dt>原始 DSM</dt>
        <dd>{sample.raw?.toFixed(2) ?? "—"} m</dd>
      </dl>
      {player && (
        <>
          <h3>玩家空间验收</h3>
          <p data-testid="player-state">
            WGS84 {player.longitude.toFixed(7)}, {player.latitude.toFixed(7)}
            <br />
            XYZ {player.x.toFixed(2)}, {player.y.toFixed(2)},{" "}
            {player.z.toFixed(2)} m<br />
            DSM {player.raw?.toFixed(2)} m · 坡度 {player.slope.toFixed(1)}°
            <br />
            {player.road}
            <br />
            累计 {player.distance.toFixed(1)} m · {player.blocked || "可通行"}
          </p>
        </>
      )}
      {stats && (
        <p className="geo-stats" data-testid="geo-stats">
          {stats.fps} FPS · {stats.calls} draw calls
          <br />
          {stats.triangles.toLocaleString()} triangles · {stats.geometries}{" "}
          geometries
          <br />
          {stats.heapMB === null
            ? "JS heap 不可用"
            : `JS heap ${stats.heapMB} MB`}{" "}
          · {stats.textures} textures
        </p>
      )}
    </details>
  );
}
