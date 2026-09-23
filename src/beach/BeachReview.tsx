import { useEffect, useRef, useState } from "react";
import type { CameraMode } from "../game/camera/mapCamera";
import type { MapSample, MapStats } from "../game/world/MapScene";
import type { PlayerState } from "../game/world/player";
import { appRoute, publicDataUrl } from "../game/data/publicUrl";
import { loadBeachWorld } from "./data/loadBeachWorld";
import type { BeachWorldData } from "./data/types";
import {
  BeachScene,
  type BeachHandle,
} from "./world/BeachScene";
import {
  DEFAULT_BEACH_LAYERS,
  type BeachLayerId,
} from "./world/buildBeachLayers";
import type { BeachViewPreset } from "./world/beachCamera";
import "../game/ui/map.css";
import "./beach.css";

const layerLabels: Record<BeachLayerId, string> = {
  terrain: "DEM 高程地形",
  ocean: "海面占位",
  landuse: "土地用途",
  beach: "沙滩面",
  roads: "道路",
  buildings: "建筑 footprint",
  coastline: "海岸线",
  pois: "主要 POI",
  geoOverlay: "核心区 / 缓冲区边界",
};

function debugMapHref() {
  return appRoute("debug/map/");
}

export default function BeachReview() {
  const [data, setData] = useState<BeachWorldData | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<CameraMode>("top");
  const [visibility, setVisibility] = useState(DEFAULT_BEACH_LAYERS);
  const [sample, setSample] = useState<MapSample | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [stats, setStats] = useState<MapStats | null>(null);
  const scene = useRef<BeachHandle>(null);
  useEffect(() => {
    document.title = "东岙沙滩 · Step 1 场景切片";
    const controller = new AbortController();
    loadBeachWorld(controller.signal)
      .then(setData)
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, []);

  const preset = (value: BeachViewPreset) => {
    setMode(value === "home" ? "top" : "oblique");
    requestAnimationFrame(() => scene.current?.preset(value));
  };

  return (
    <main className="beach-app">
      <header className="beach-header">
        <div>
          <span>STEP 1 · BEACH GAME SCENE SLICE</span>
          <h1>东岙沙滩 · 场景范围验证</h1>
          <p>真实 WGS84 骨架 · 400m 核心区 · 每侧 100m 视觉缓冲</p>
        </div>
        <a href={debugMapHref()}>返回 Debug Map ↗</a>
      </header>
      <div className={`beach-workspace ${import.meta.env.DEV ? "is-dev" : ""}`}>
        <section className="beach-stage" aria-label="沙滩场景切片验证区">
          {data && (
            <BeachScene
              ref={scene}
              data={data}
              mode={mode}
              visibility={visibility}
              onSample={setSample}
              onPlayer={setPlayer}
              onStats={setStats}
              onError={setError}
            />
          )}
          {!data && !error && <p className="geo-message">正在读取沙滩切片…</p>}
          {error && (
            <div className="geo-message geo-error" role="alert">
              <strong>沙滩切片暂不可显示</strong>
              <p>{error}</p>
              <button onClick={() => location.reload()}>重新加载</button>
            </div>
          )}
          <div className="beach-toolbar">
            <button onClick={() => preset("home")}>俯视全景</button>
            <button onClick={() => preset("beach-to-village")}>View A</button>
            <button onClick={() => preset("village-to-sea")}>View B</button>
            <button onClick={() => preset("along-beach")}>View C</button>
            <button onClick={() => scene.current?.zoom(1.35)}>＋</button>
            <button onClick={() => scene.current?.zoom(1 / 1.35)}>−</button>
          </div>
          <div className="beach-walk">
            <button
              onClick={() => {
                setMode("oblique");
                requestAnimationFrame(() => scene.current?.walk());
              }}
            >
              跟随临时玩家
            </button>
            <span>WASD / 方向键</span>
          </div>
          <div className="geo-dpad beach-dpad" aria-label="沙滩触控方向键">
            {(
              [
                ["北", 0, -1],
                ["西", -1, 0],
                ["南", 0, 1],
                ["东", 1, 0],
              ] as const
            ).map(([name, x, z]) => (
              <button
                key={name}
                aria-label={`向${name}移动`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  scene.current?.input(x, z);
                }}
                onPointerUp={() => scene.current?.input(0, 0)}
                onPointerCancel={() => scene.current?.input(0, 0)}
                onLostPointerCapture={() => scene.current?.input(0, 0)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="beach-boundary-key" aria-label="边界图例">
            <span><i className="core" />核心可玩区</span>
            <span><i className="buffer" />视觉缓冲边界</span>
          </div>
        </section>
        {import.meta.env.DEV && data && (
          <aside className="beach-debug" aria-label="沙滩切片开发检查">
            <span className="beach-status">DEV ONLY · STEP 1</span>
            <h2>切片数据检查</h2>
            <p>
              仅验证范围、坐标与空间关系。没有环境美术、动态海面或最终玩家表现。
            </p>
            <dl>
              <dt>核心区</dt>
              <dd>{data.slice.coreSizeMeters.width.toFixed(1)} × {data.slice.coreSizeMeters.depth.toFixed(1)}m</dd>
              <dt>含缓冲</dt>
              <dd>{data.slice.bufferSizeMeters.width.toFixed(1)} × {data.slice.bufferSizeMeters.depth.toFixed(1)}m</dd>
              <dt>建筑</dt>
              <dd>{data.report.counts.buildings}</dd>
              <dt>道路</dt>
              <dd>{data.report.counts.roads}</dd>
              <dt>DEM</dt>
              <dd>{data.dem.width} × {data.dem.height}</dd>
            </dl>
            <h3>图层</h3>
            <div className="beach-layer-list">
              {(Object.keys(layerLabels) as BeachLayerId[]).map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={visibility[id]}
                    onChange={() =>
                      setVisibility((current) => ({
                        ...current,
                        [id]: !current[id],
                      }))
                    }
                  />
                  {layerLabels[id]}
                </label>
              ))}
            </div>
            {sample && (
              <>
                <h3>地图游标</h3>
                <dl data-testid="beach-sample">
                  <dt>Longitude</dt><dd>{sample.longitude.toFixed(7)}</dd>
                  <dt>Latitude</dt><dd>{sample.latitude.toFixed(7)}</dd>
                  <dt>World X / Z</dt><dd>{sample.x.toFixed(2)} / {sample.z.toFixed(2)}m</dd>
                  <dt>Terrain</dt><dd>{sample.height.toFixed(2)}m</dd>
                  <dt>Raw DEM</dt><dd>{sample.raw?.toFixed(2) ?? "—"}m</dd>
                </dl>
              </>
            )}
            {player && (
              <>
                <h3>临时出生点 / 玩家</h3>
                <p data-testid="beach-player">
                  {player.longitude.toFixed(7)}, {player.latitude.toFixed(7)}<br />
                  XYZ {player.x.toFixed(2)}, {player.y.toFixed(2)}, {player.z.toFixed(2)}m<br />
                  坡度 {player.slope.toFixed(1)}° · {player.blocked || "可通行"}
                </p>
              </>
            )}
            {stats && (
              <p className="beach-stats" data-testid="beach-stats">
                {stats.fps} FPS · {stats.calls} calls · {stats.triangles.toLocaleString()} triangles
              </p>
            )}
            <a href={publicDataUrl("dongao-beach/manifest.json")}>
              查看切片 manifest ↗
            </a>
          </aside>
        )}
      </div>
    </main>
  );
}
