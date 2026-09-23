import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { loadWorld } from "./data/loadWorld";
import type { WorldData } from "./data/types";
import {
  MapScene,
  type MapHandle,
  type MapSample,
  type MapStats,
} from "./world/MapScene";
import { DEFAULT_LAYERS } from "./world/layers";
import type { CameraMode } from "./camera/mapCamera";
import type { PlayerState } from "./world/player";
import { GEO_CONFIG } from "./geo/geoConfig";
import { publicDataUrl } from "./data/publicUrl";
import "./ui/map.css";
const DebugPanel = import.meta.env.DEV
  ? lazy(() => import("./ui/DebugPanel"))
  : null;
export default function MapReview() {
  const [data, setData] = useState<WorldData | null>(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState<CameraMode>("top"),
    [visibility, setVisibility] = useState(DEFAULT_LAYERS);
  const [sample, setSample] = useState<MapSample>({
      x: 0,
      z: 0,
      ...GEO_CONFIG.center,
      height: 0,
    }),
    [stats, setStats] = useState<MapStats | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const map = useRef<MapHandle>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadWorld(controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "m" &&
        !e.repeat &&
        !(
          e.target instanceof HTMLInputElement &&
          !["checkbox", "radio", "range", "button"].includes(e.target.type)
        ) &&
        !(e.target instanceof HTMLTextAreaElement)
      )
        setMode((m) => (m === "top" ? "oblique" : "top"));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <main className="geo-app">
      <header className="geo-header">
        <div>
          <span className="geo-eyebrow">DONG'AO · SPATIAL PROTOTYPE / 01</span>
          <h1>东岙 · 真实地图骨架</h1>
          <p>WGS84 · 约 2 × 2 km · 真实 DSM · 1:1 高程</p>
        </div>
        <a href="?demo=legacy">原概念演示 ↗</a>
      </header>
      <div className="geo-workspace">
        <section className="geo-map" aria-label="地图审阅区">
          {data && (
            <MapScene
              ref={map}
              data={data}
              mode={mode}
              visibility={visibility}
              onPlayer={setPlayer}
              onSample={setSample}
              onStats={setStats}
              onError={setError}
            />
          )}
          {!data && !error && (
            <p className="geo-message" role="status">
              正在读取本地地图缓存…
            </p>
          )}
          {error && (
            <div className="geo-message geo-error" role="alert">
              <strong>地图暂不可显示</strong>
              <p>{error}</p>
              <button onClick={() => location.reload()}>重新加载</button>
            </div>
          )}
          <div className="geo-map-toolbar">
            <button
              onClick={() => setMode((m) => (m === "top" ? "oblique" : "top"))}
            >
              {mode === "top" ? "切换倾斜视角" : "切换俯视地图"} <kbd>M</kbd>
            </button>
            <button
              aria-label="地图回到全景"
              onClick={() => map.current?.home()}
            >
              全景
            </button>
            <button
              aria-label="放大真实地图"
              onClick={() => map.current?.zoom(1.4)}
            >
              ＋
            </button>
            <button
              aria-label="缩小真实地图"
              onClick={() => map.current?.zoom(1 / 1.4)}
            >
              −
            </button>
          </div>
          <div className="geo-walk-controls">
            <button
              onClick={() => {
                setMode("oblique");
                setTimeout(() => map.current?.walk(), 0);
              }}
            >
              跟随玩家
            </button>
            <span>WASD / 方向键 · 北向移动</span>
          </div>
          <div className="geo-dpad" aria-label="触控方向键">
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
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  map.current?.input(x, z);
                }}
                onPointerUp={() => map.current?.input(0, 0)}
                onPointerCancel={() => map.current?.input(0, 0)}
                onLostPointerCapture={() => map.current?.input(0, 0)}
              >
                {name}
              </button>
            ))}
          </div>
          <span className="geo-north">
            {mode === "top" ? "↑ N · 正北" : "倾斜视角"}
          </span>
          <div className="geo-map-caption">
            <span>
              {mode === "top"
                ? "拖动平移 · 滚轮 / 双指缩放"
                : "拖动环视 · 右键 / 双指平移"}
            </span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap contributors · ODbL
            </a>
          </div>
        </section>
        <aside className="geo-sidebar" aria-label="地图数据与调试">
          <section className="geo-review-state">
            <span className="geo-status">地理 QA · 尚未通过</span>
            <h2>真实地形与步行验收</h2>
            <p>
              海岸与道路来自 OSM；山体来自 Copernicus GLO-30。高程倍率
              1×，原始分辨率约 30m。
            </p>
          </section>
          {data && (
            <>
              <div className="geo-counts">
                <div>
                  <b>{data.report.counts.roads}</b>
                  <span>道路要素</span>
                </div>
                <div>
                  <b>{data.report.counts.coastline}</b>
                  <span>岸线片段</span>
                </div>
                <div>
                  <b>{data.report.counts.buildings}</b>
                  <span>建筑轮廓</span>
                </div>
              </div>
              <div className="geo-data-gap" role="note">
                <strong>建筑与配准仍待核实</strong>
                <p>
                  OSM + East Asian Buildings 公开轮廓；无实测高度时统一暂定
                  6m。ML 提取误差、高德 POI 与现场入口仍待核实。
                </p>
              </div>
              <section className="geo-locations">
                <h2>真实位置</h2>
                {data.pois
                  .filter((p) => ["东岙村", "东岙沙滩"].includes(p.name))
                  .map((p) => (
                    <div className="geo-location" key={p.id}>
                      <button
                        onClick={() =>
                          map.current?.focus(p.latitude, p.longitude)
                        }
                      >
                        <b>{p.name}</b>
                        <span>
                          {p.longitude.toFixed(6)}°E / {p.latitude.toFixed(6)}°N
                        </span>
                      </button>
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`查看${p.name} OSM 来源`}
                      >
                        ↗
                      </a>
                    </div>
                  ))}
              </section>
              <div className="geo-legend">
                <span>
                  <i style={{ background: "#7fb8c5" }} />海 / 水体
                </span>
                <span>
                  <i style={{ background: "#edcf8a" }} />
                  沙滩
                </span>
                <span>
                  <i style={{ background: "#a9c09b" }} />
                  林地
                </span>
                <span>
                  <i style={{ background: "#dacbb3" }} />
                  住宅用地
                </span>
                <span>
                  <i style={{ background: "#fffdf1" }} />
                  道路
                </span>
                <span>
                  <i style={{ background: "#b37861" }} />
                  建筑
                </span>
              </div>
              {DebugPanel && (
                <Suspense fallback={null}>
                  <DebugPanel
                    visibility={visibility}
                    onChange={(id) =>
                      setVisibility((v) => ({ ...v, [id]: !v[id] }))
                    }
                    player={player}
                    sample={sample}
                    stats={stats}
                  />
                </Suspense>
              )}
              <p className="geo-source-note">
                地形：Copernicus WorldDEM-30 / EU & ESA。
                <a href={publicDataUrl("dongao/LICENSE.md")}>完整许可与署名</a>
              </p>
              <p className="geo-source-note">
                OSM 数据时间：{data.report.source.osmTimestamp.slice(0, 10)}
                <br />
                POI 面内代表点不等于入口；路网完整性待现场核对。
              </p>
              <a
                className="geo-source-link"
                href={publicDataUrl("dongao/quality-report.json")}
                target="_blank"
                rel="noreferrer"
              >
                查看数据来源与质量报告 ↗
              </a>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
