import type { LayerId, LayerVisibility } from "../world/layers";
import type { MapSample, MapStats } from "../world/MapScene";
const labels: Record<LayerId, string> = {
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
}: {
  visibility: LayerVisibility;
  onChange: (id: LayerId) => void;
  sample: MapSample;
  stats: MapStats | null;
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
        <label>
          <input type="checkbox" disabled />
          DEM · 待确认后接入
        </label>
      </div>
      <h3>
        地图游标 <small>玩家尚未加入</small>
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
        <dd>{sample.height.toFixed(1)} m · 平面占位</dd>
      </dl>
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
