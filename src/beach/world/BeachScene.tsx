import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import type { CameraMode } from "../../game/camera/mapCamera";
import { geoToWorld, isInBounds, worldToGeo } from "../../game/geo/coordinates";
import type {
  MapSample,
  MapStats,
} from "../../game/world/MapScene";
import { disposeWorld } from "../../game/world/layers";
import { createPlayer, type PlayerState } from "../../game/world/player";
import { getTerrainHeight, queryTerrain } from "../../game/world/terrain";
import type { BeachWorldData } from "../data/types";
import {
  buildBeachLayers,
  type BeachLayerVisibility,
} from "./buildBeachLayers";
import {
  createBeachCamera,
  type BeachViewPreset,
} from "./beachCamera";

export type BeachHandle = {
  input: (x: number, z: number) => void;
  home: () => void;
  zoom: (factor: number) => void;
  walk: () => void;
  preset: (preset: BeachViewPreset) => void;
};

type Props = {
  data: BeachWorldData;
  mode: CameraMode;
  visibility: BeachLayerVisibility;
  onSample: (sample: MapSample) => void;
  onPlayer: (player: PlayerState) => void;
  onStats: (stats: MapStats) => void;
  onError: (message: string) => void;
};

type Runtime = BeachHandle & {
  setMode: (mode: CameraMode) => void;
  setVisibility: (visibility: BeachLayerVisibility) => void;
  destroy: () => void;
};

export const BeachScene = forwardRef<BeachHandle, Props>(
  function BeachScene(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const runtime = useRef<Runtime | null>(null);
    const callbacks = useRef(props);
    callbacks.current = props;
    useImperativeHandle(
      ref,
      () => ({
        input: (x, z) => runtime.current?.input(x, z),
        home: () => runtime.current?.home(),
        zoom: (factor) => runtime.current?.zoom(factor),
        walk: () => runtime.current?.walk(),
        preset: (preset) => runtime.current?.preset(preset),
      }),
      [],
    );
    useEffect(() => {
      try {
        runtime.current = createRuntime(host.current!, props.data, callbacks);
        runtime.current.setMode(callbacks.current.mode);
        runtime.current.setVisibility(callbacks.current.visibility);
      } catch (error) {
        callbacks.current.onError(
          error instanceof Error ? error.message : "无法初始化沙滩 WebGL 场景",
        );
      }
      return () => {
        runtime.current?.destroy();
        runtime.current = null;
      };
    }, [props.data]);
    useEffect(() => runtime.current?.setMode(props.mode), [props.mode]);
    useEffect(
      () => runtime.current?.setVisibility(props.visibility),
      [props.visibility],
    );
    return (
      <div
        className="beach-canvas"
        ref={host}
        aria-label="东岙沙滩场景切片"
      />
    );
  },
);

function createRuntime(
  host: HTMLDivElement,
  data: BeachWorldData,
  callbacks: { current: Props },
): Runtime {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor("#e7ede7");
  renderer.domElement.setAttribute("aria-label", "东岙沙滩 Step 1 验证画布");
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#7f8980", 2.2));
  const sun = new THREE.DirectionalLight("#fff8e8", 1.4);
  sun.position.set(-300, 800, 250);
  scene.add(sun);
  const rig = createBeachCamera(renderer.domElement, data.slice.bufferBbox);
  const world = buildBeachLayers(data);
  scene.add(world.root);

  const player = createPlayer(data, {
    spawn: data.slice.spawn,
    bounds: data.slice.coreBbox,
  });
  const avatar = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.6, 1.1, 3, 6),
    new THREE.MeshLambertMaterial({ color: "#ef6335" }),
  );
  body.position.y = 1.1;
  avatar.add(body);
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 2.7, 4),
    new THREE.MeshBasicMaterial({ color: "#ef6335" }),
  );
  marker.position.y = 4.2;
  marker.rotation.x = Math.PI;
  avatar.add(marker);
  world.root.add(avatar);

  callbacks.current.onSample({
    x: player.state.x,
    z: player.state.z,
    latitude: player.state.latitude,
    longitude: player.state.longitude,
    height: player.state.y,
    raw: player.state.raw,
  });
  callbacks.current.onPlayer({ ...player.state });

  const keys = new Set<string>();
  let inputX = 0;
  let inputZ = 0;
  let follow = false;
  let lastTime = performance.now();
  const keyboard = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    const key = event.key.toLowerCase();
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
      ].includes(key)
    ) {
      event.preventDefault();
      if (event.type === "keydown") keys.add(key);
      else keys.delete(key);
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

  const labels = document.createElement("div");
  labels.className = "beach-labels";
  host.appendChild(labels);
  const labelElements = data.pois.map((poi) => {
    const label = document.createElement("span");
    label.className = "beach-poi-label";
    label.textContent = poi.name;
    label.dataset.poi = poi.id;
    labels.appendChild(label);
    return { poi, label };
  });
  const scale = document.createElement("div");
  scale.className = "beach-scale";
  scale.textContent = "100 m";
  host.appendChild(scale);
  host.appendChild(renderer.domElement);

  let width = 1;
  let height = 1;
  let frame = 0;
  let destroyed = false;
  let lost = false;
  let frames = 0;
  let statsAt = performance.now();
  let lastSample = 0;
  let latestStats: MapStats | null = null;
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

  const walk = () => {
    follow = true;
    rig.setMode("oblique");
    rig.focus(player.state.x, player.state.z);
    rig.camera.zoom = 12;
    rig.camera.updateProjectionMatrix();
  };

  const qa = {
    player: player.state,
    manifest: data.manifest,
    stats: () => latestStats,
    reset: () => player.reset(),
    move: (x: number, z: number, dt: number) => player.move(x, z, dt),
  };
  if (import.meta.env.DEV)
    (window as unknown as { __beachQA: typeof qa }).__beachQA = qa;

  function render(now: number) {
    if (destroyed || lost || document.hidden) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const x =
      inputX +
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft"));
    const z =
      inputZ +
      Number(keys.has("s") || keys.has("arrowdown")) -
      Number(keys.has("w") || keys.has("arrowup"));
    if (x || z) player.move(x, z, dt);
    avatar.position.set(player.state.x, player.state.y, player.state.z);
    if (follow) {
      const target = new THREE.Vector3(
        player.state.x,
        player.state.y,
        player.state.z,
      );
      const delta = target.clone().sub(rig.controls.target);
      rig.controls.target.copy(target);
      rig.camera.position.add(delta);
    } else rig.constrain();
    rig.controls.update();
    scale.style.width = `${(100 * width * rig.camera.zoom) / (rig.camera.right - rig.camera.left)}px`;
    scale.style.display = rig.mode === "top" && !follow ? "" : "none";
    for (const { poi, label } of labelElements) {
      const point = geoToWorld(poi.latitude, poi.longitude);
      projected
        .set(point.x, getTerrainHeight(point.x, point.z) + 5, point.z)
        .project(rig.camera);
      label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px) translate(-50%, -130%)`;
      label.style.display =
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1 ||
        projected.z > 1 ||
        projected.z < -1
          ? "none"
          : "";
    }
    renderer.render(scene, rig.camera);
    frames++;
    if (now - statsAt >= 1000) {
      const performanceWithMemory = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      latestStats = {
        fps: Math.round((frames * 1000) / (now - statsAt)),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        heapMB: performanceWithMemory.memory
          ? Math.round(performanceWithMemory.memory.usedJSHeapSize / 1048576)
          : null,
      };
      callbacks.current.onStats(latestStats);
      callbacks.current.onPlayer({ ...player.state });
      statsAt = now;
      frames = 0;
    }
    frame = requestAnimationFrame(render);
  }

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const sample = (event: PointerEvent) => {
    if (performance.now() - lastSample < 70) return;
    lastSample = performance.now();
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      rig.camera,
    );
    const terrainHit = ray.intersectObjects(world.layers.terrain.children, true)[0];
    if (terrainHit) hit.copy(terrainHit.point);
    if (terrainHit || ray.ray.intersectPlane(plane, hit)) {
      const geo = worldToGeo(hit.x, hit.z);
      if (isInBounds(geo, data.slice.bufferBbox)) {
        const terrain = queryTerrain(hit.x, hit.z);
        callbacks.current.onSample({
          x: hit.x,
          z: hit.z,
          ...geo,
          height: terrain.rendered ?? 0,
          raw: terrain.raw,
        });
      }
    }
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    callbacks.current.onError("沙滩场景 WebGL 上下文已丢失，请刷新重试");
  };
  renderer.domElement.addEventListener("pointermove", sample);
  renderer.domElement.addEventListener("pointerdown", sample);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  frame = requestAnimationFrame(render);

  return {
    input(x, z) {
      inputX = x;
      inputZ = z;
    },
    home() {
      follow = false;
      rig.home();
    },
    zoom: rig.zoom,
    walk,
    preset(value) {
      follow = false;
      rig.preset(value);
    },
    setMode(mode) {
      follow = false;
      rig.setMode(mode);
    },
    setVisibility(visibility) {
      for (const key of Object.keys(visibility) as (keyof BeachLayerVisibility)[])
        world.layers[key].visible = visibility[key];
      labels.hidden = !visibility.pois;
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
      renderer.domElement.removeEventListener("pointermove", sample);
      renderer.domElement.removeEventListener("pointerdown", sample);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      if (import.meta.env.DEV)
        delete (window as unknown as { __beachQA?: typeof qa }).__beachQA;
    },
  };
}
