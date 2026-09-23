import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { WorldData } from "../data/types";
import { createMapCamera, type CameraMode } from "../camera/mapCamera";
import { buildWorldLayers, disposeWorld, type LayerVisibility } from "./layers";
import { geoToWorld, worldToGeo, isInBounds } from "../geo/coordinates";
import { getTerrainHeight } from "./terrain";
export type MapSample = {
  x: number;
  z: number;
  latitude: number;
  longitude: number;
  height: number;
};
export type MapStats = {
  fps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  heapMB: number | null;
};
export type MapHandle = {
  home: () => void;
  zoom: (factor: number) => void;
  focus: (latitude: number, longitude: number) => void;
};
type Props = {
  data: WorldData;
  mode: CameraMode;
  visibility: LayerVisibility;
  onSample: (p: MapSample) => void;
  onStats: (s: MapStats) => void;
  onError: (message: string) => void;
};
type Runtime = MapHandle & {
  setMode: (mode: CameraMode) => void;
  setVisibility: (v: LayerVisibility) => void;
  destroy: () => void;
};
export const MapScene = forwardRef<MapHandle, Props>(
  function MapScene(props, ref) {
    const host = useRef<HTMLDivElement>(null),
      runtime = useRef<Runtime | null>(null),
      callbacks = useRef(props);
    callbacks.current = props;
    useImperativeHandle(
      ref,
      () => ({
        home: () => runtime.current?.home(),
        zoom: (f) => runtime.current?.zoom(f),
        focus: (lat, lon) => runtime.current?.focus(lat, lon),
      }),
      [],
    );
    useEffect(() => {
      try {
        runtime.current = createRuntime(host.current!, props.data, callbacks);
        runtime.current.setMode(callbacks.current.mode);
        runtime.current.setVisibility(callbacks.current.visibility);
      } catch (e) {
        callbacks.current.onError(
          e instanceof Error ? e.message : "无法初始化 WebGL",
        );
      }
      return () => {
        runtime.current?.destroy();
        runtime.current = null;
      };
    }, [props.data]);
    useEffect(() => {
      runtime.current?.setMode(props.mode);
    }, [props.mode]);
    useEffect(() => {
      runtime.current?.setVisibility(props.visibility);
    }, [props.visibility]);
    return (
      <div className="geo-canvas" ref={host} aria-label="东岙 OSM 三维地图" />
    );
  },
);
function createRuntime(
  host: HTMLDivElement,
  data: WorldData,
  callbacks: { current: Props },
): Runtime {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor("#ecf0e9");
  renderer.domElement.setAttribute("aria-label", "真实东岙地图画布");
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#879186", 2.1));
  const sun = new THREE.DirectionalLight("#fff7e4", 1.6);
  sun.position.set(-800, 1800, 500);
  scene.add(sun);
  const rig = createMapCamera(renderer.domElement);
  let world: ReturnType<typeof buildWorldLayers>;
  try {
    world = buildWorldLayers(data);
  } catch (e) {
    rig.controls.dispose();
    renderer.dispose();
    throw e;
  }
  scene.add(world.root);
  host.appendChild(renderer.domElement);
  const labels = document.createElement("div");
  labels.className = "geo-labels";
  host.appendChild(labels);
  const labelElements = data.pois.map((p) => {
    const label = document.createElement("span");
    label.className = "geo-poi-label";
    label.textContent = p.name;
    label.dataset.poi = p.id;
    labels.appendChild(label);
    return { p, label };
  });
  let frame = 0,
    destroyed = false,
    lost = false,
    width = 1,
    height = 1,
    statsAt = performance.now(),
    frames = 0,
    lastSample = 0;
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    rig.resize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const projected = new THREE.Vector3();
  function render(now: number) {
    if (destroyed || lost || document.hidden) return;
    rig.controls.update();
    rig.constrain();
    for (const { p, label } of labelElements) {
      const { x, z } = geoToWorld(p.latitude, p.longitude);
      projected.set(x, 5, z).project(rig.camera);
      label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px) translate(-50%, -130%)`;
      // At full extent prioritize the two review landmarks; zoom reveals the remaining OSM names.
      label.style.display =
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1 ||
        projected.z > 1 ||
        projected.z < -1 ||
        (!["东岙村", "东岙沙滩"].includes(p.name) && rig.camera.zoom < 1.8)
          ? "none"
          : "";
    }
    renderer.render(scene, rig.camera);
    frames++;
    if (now - statsAt >= 1000) {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      callbacks.current.onStats({
        fps: Math.round((frames * 1000) / (now - statsAt)),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        heapMB: perf.memory
          ? Math.round(perf.memory.usedJSHeapSize / 1048576)
          : null,
      });
      statsAt = now;
      frames = 0;
    }
    frame = requestAnimationFrame(render);
  }
  const ray = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit = new THREE.Vector3();
  const sample = (e: PointerEvent) => {
    if (performance.now() - lastSample < 70) return;
    lastSample = performance.now();
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      rig.camera,
    );
    if (ray.ray.intersectPlane(plane, hit)) {
      const geo = worldToGeo(hit.x, hit.z);
      if (isInBounds(geo))
        callbacks.current.onSample({
          x: hit.x,
          z: hit.z,
          ...geo,
          height: getTerrainHeight(hit.x, hit.z),
        });
    }
  };
  const visibility = () => {
    cancelAnimationFrame(frame);
    frames = 0;
    statsAt = performance.now();
    if (!document.hidden && !lost) frame = requestAnimationFrame(render);
  };
  const contextLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    callbacks.current.onError(
      "WebGL 上下文已丢失，请刷新重试。静态数据与 POI 列表仍可查看。",
    );
  };
  renderer.domElement.addEventListener("pointermove", sample);
  renderer.domElement.addEventListener("pointerdown", sample);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  frame = requestAnimationFrame(render);
  return {
    home: rig.home,
    zoom: rig.zoom,
    focus(lat, lon) {
      const p = geoToWorld(lat, lon);
      rig.focus(p.x, p.z);
    },
    setMode: rig.setMode,
    setVisibility(v) {
      for (const key of Object.keys(v) as (keyof LayerVisibility)[])
        world.layers[key].visible = v[key];
      labels.hidden = !v.pois;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      rig.controls.dispose();
      disposeWorld(world.root);
      renderer.dispose();
      renderer.domElement.remove();
      labels.remove();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("pointermove", sample);
      renderer.domElement.removeEventListener("pointerdown", sample);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    },
  };
}
