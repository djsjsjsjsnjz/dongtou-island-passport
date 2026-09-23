import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { WorldData } from "../data/types";
import { createMapCamera, type CameraMode } from "../camera/mapCamera";
import { buildWorldLayers, disposeWorld, type LayerVisibility } from "./layers";
import { geoToWorld, worldToGeo, isInBounds } from "../geo/coordinates";
import { QA_ROUTE } from "./qaRoute";
import { createPlayer, type PlayerState } from "./player";
import { queryTerrain } from "./terrain";
import { getTerrainHeight } from "./terrain";
export type MapSample = {
  x: number;
  z: number;
  latitude: number;
  longitude: number;
  height: number;
  raw?: number | null;
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
  walk: () => void;
  input: (x: number, z: number) => void;
  home: () => void;
  zoom: (factor: number) => void;
  focus: (latitude: number, longitude: number) => void;
};
type Props = {
  data: WorldData;
  mode: CameraMode;
  visibility: LayerVisibility;
  onSample: (p: MapSample) => void;
  onPlayer: (p: PlayerState) => void;
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
        walk: () => runtime.current?.walk(),
        input: (x, z) => runtime.current?.input(x, z),
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
  callbacks.current.onSample({
    x: 0,
    z: 0,
    ...worldToGeo(0, 0),
    height: getTerrainHeight(0, 0),
    raw: queryTerrain(0, 0).raw,
  });
  const player = createPlayer(data);
  const avatar = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.6, 1.1, 3, 6),
    new THREE.MeshLambertMaterial({ color: "#ec612d" }),
  );
  body.position.y = 1.1;
  avatar.add(body);
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 3, 4),
    new THREE.MeshBasicMaterial({ color: "#f26936" }),
  );
  marker.position.y = 4.5;
  marker.rotation.x = Math.PI;
  avatar.add(marker);
  world.root.add(avatar);
  const keys = new Set<string>();
  let inputX = 0,
    inputZ = 0,
    follow = false,
    lastTime = performance.now();
  const keyboard = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const k = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k)
    ) {
      e.preventDefault();
      if (e.type === "keydown") keys.add(k);
      else keys.delete(k);
    }
  };
  const clearInput = () => {
    keys.clear();
    inputX = inputZ = 0;
    lastTime = performance.now();
  };
  window.addEventListener("keydown", keyboard);
  window.addEventListener("keyup", keyboard);
  window.addEventListener("blur", clearInput);
  const walk = () => {
    follow = true;
    rig.setMode("oblique");
    rig.focus(player.state.x, player.state.z);
    rig.camera.zoom = 14;
    rig.camera.updateProjectionMatrix();
  };
  let latestStats: MapStats | null = null;
  const route = QA_ROUTE.map((p) => geoToWorld(p.latitude, p.longitude));
  const playback = { active: false, index: 1, direction: 1, laps: 0 };
  const qa = {
    playback,
    startRoute: () => {
      player.reset();
      playback.active = true;
      playback.index = 1;
      playback.direction = 1;
      playback.laps = 0;
      walk();
    },
    stopRoute: () => {
      playback.active = false;
    },
    player: player.state,
    stats: () => latestStats,
    walk,
    reset: () => player.reset(),
    move: (x: number, z: number, dt: number) => player.move(x, z, dt),
  };
  if (import.meta.env.DEV)
    (window as unknown as { __geoQA: typeof qa }).__geoQA = qa;
  const scale = document.createElement("div");
  scale.className = "geo-scale";
  scale.textContent = "100 m";
  host.appendChild(scale);
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
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const ix =
      inputX +
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft"));
    const iz =
      inputZ +
      Number(keys.has("s") || keys.has("arrowdown")) -
      Number(keys.has("w") || keys.has("arrowup"));
    if (ix || iz) {
      playback.active = false;
      player.move(ix, iz, dt);
    } else if (import.meta.env.DEV && playback.active) {
      const t = route[playback.index],
        dx = t.x - player.state.x,
        dz = t.z - player.state.z;
      if (Math.hypot(dx, dz) < 0.25) {
        if (playback.index === route.length - 1 || playback.index === 0) {
          playback.direction *= -1;
          playback.laps++;
        }
        playback.index += playback.direction;
      } else {
        player.move(dx, dz, Math.min(dt, Math.hypot(dx, dz) / 3.2));
        if (player.state.blocked) playback.active = false;
      }
    }
    world.layers.reference.visible =
      callbacks.current.visibility.reference &&
      callbacks.current.mode === "top" &&
      !follow;
    avatar.position.set(player.state.x, player.state.y, player.state.z);
    if (follow) {
      const target = new THREE.Vector3(
          player.state.x,
          player.state.y,
          player.state.z,
        ),
        delta = target.clone().sub(rig.controls.target);
      rig.controls.target.copy(target);
      rig.camera.position.add(delta);
    }
    rig.controls.update();
    if (!follow) rig.constrain();
    scale.style.width = `${(100 * width * rig.camera.zoom) / (rig.camera.right - rig.camera.left)}px`;
    scale.style.display =
      callbacks.current.mode === "top" && !follow ? "" : "none";
    for (const { p, label } of labelElements) {
      const { x, z } = geoToWorld(p.latitude, p.longitude);
      projected.set(x, getTerrainHeight(x, z) + 5, z).project(rig.camera);
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
      latestStats = {
        fps: Math.round((frames * 1000) / (now - statsAt)),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        heapMB: perf.memory
          ? Math.round(perf.memory.usedJSHeapSize / 1048576)
          : null,
      };
      callbacks.current.onStats(latestStats);
      callbacks.current.onPlayer({ ...player.state });
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
    const terrainHit = ray.intersectObjects(world.layers.dem.children, true)[0];
    if (terrainHit) hit.copy(terrainHit.point);
    if (terrainHit || ray.ray.intersectPlane(plane, hit)) {
      const geo = worldToGeo(hit.x, hit.z);
      if (isInBounds(geo))
        callbacks.current.onSample({
          x: hit.x,
          z: hit.z,
          ...geo,
          height: getTerrainHeight(hit.x, hit.z),
          raw: queryTerrain(hit.x, hit.z).raw,
        });
    }
  };
  const visibility = () => {
    clearInput();
    playback.active = false;
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
    walk,
    input(x, z) {
      inputX = x;
      inputZ = z;
    },
    home() {
      follow = false;
      rig.home();
    },
    zoom: rig.zoom,
    focus(lat, lon) {
      follow = false;
      const p = geoToWorld(lat, lon);
      rig.focus(p.x, p.z);
    },
    setMode(m) {
      follow = false;
      rig.setMode(m);
    },
    setVisibility(v) {
      for (const key of Object.keys(v) as (keyof LayerVisibility)[])
        world.layers[key].visible = v[key];
      world.layers.landuse.visible = v.landuse && v.dem;
      world.layers.elevation.visible = v.elevation && v.dem;
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
      scale.remove();
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("keyup", keyboard);
      window.removeEventListener("blur", clearInput);
      if (import.meta.env.DEV)
        delete (window as unknown as { __geoQA?: typeof qa }).__geoQA;
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("pointermove", sample);
      renderer.domElement.removeEventListener("pointerdown", sample);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    },
  };
}
