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
import { GEO_CONFIG } from "./geo/geoConfig";
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
          <p>WGS84 · 约 2 × 2 km · OSM 审阅阶段</p>
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
            <span className="geo-status">等待空间核对</span>
            <h2>先看清楚，东岙在哪里</h2>
            <p>海岸、路网与沙滩来自 OSM。当前为平面地图，尚未接入 DEM。</p>
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
                <strong>建筑数据不足</strong>
                <p>
                  OSM 仅收录 1
                  个建筑轮廓，不能代表真实村庄分布。褐色区域是住宅用地，不是逐栋建筑。
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
                    sample={sample}
                    stats={stats}
                  />
                </Suspense>
              )}
              <p className="geo-source-note">
                OSM 数据时间：{data.report.source.osmTimestamp.slice(0, 10)}
                <br />
                POI 面内代表点不等于入口；路网完整性待现场核对。
              </p>
              <a
                className="geo-source-link"
                href={`${import.meta.env.BASE_URL}data/dongao/quality-report.json`}
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
