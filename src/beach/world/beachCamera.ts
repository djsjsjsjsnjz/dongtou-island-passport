import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { geoToWorld } from "../../game/geo/coordinates";
import type { BoundingBox } from "../../game/geo/geoTypes";
import type { CameraMode } from "../../game/camera/mapCamera";

export type BeachViewPreset = "home" | "beach-to-village" | "village-to-sea" | "along-beach";

export function createBeachCamera(
  canvas: HTMLCanvasElement,
  bufferBbox: BoundingBox,
) {
  const camera = new THREE.OrthographicCamera(-350, 350, 350, -350, 0.1, 5000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.minZoom = 0.7;
  controls.maxZoom = 16;
  controls.maxPolarAngle = Math.PI / 2.15;
  const sw = geoToWorld(bufferBbox[1], bufferBbox[0]);
  const ne = geoToWorld(bufferBbox[3], bufferBbox[2]);
  const center = new THREE.Vector3((sw.x + ne.x) / 2, 0, (sw.z + ne.z) / 2);
  const widthMeters = ne.x - sw.x;
  const depthMeters = sw.z - ne.z;
  let mode: CameraMode = "top";
  let viewportAspect = 1;

  function updateFrustum() {
    const halfHeight = Math.max(
      depthMeters / 2 + 28,
      (widthMeters / 2 + 28) / viewportAspect,
    );
    camera.left = -halfHeight * viewportAspect;
    camera.right = halfHeight * viewportAspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  function orient(target = controls.target) {
    controls.enableRotate = mode === "oblique";
    controls.mouseButtons.LEFT =
      mode === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE =
      mode === "top" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    camera.up.set(0, 1, 0);
    camera.position.set(
      target.x,
      target.y + (mode === "top" ? 1000 : 360),
      target.z + (mode === "top" ? 0.001 : 430),
    );
    controls.update();
  }

  function home() {
    mode = "top";
    controls.target.copy(center);
    camera.zoom = 1;
    orient();
    updateFrustum();
  }

  function preset(value: BeachViewPreset) {
    if (value === "home") {
      home();
      return;
    }
    mode = "oblique";
    const beach = geoToWorld(27.8242, 121.15715);
    const village = geoToWorld(27.82555, 121.1567);
    const target = new THREE.Vector3(
      (beach.x + village.x) / 2,
      24,
      (beach.z + village.z) / 2,
    );
    controls.target.copy(target);
    if (value === "beach-to-village")
      camera.position.set(beach.x, 150, beach.z + 190);
    else if (value === "village-to-sea")
      camera.position.set(village.x, 165, village.z - 200);
    else camera.position.set(target.x - 310, 150, target.z + 30);
    camera.zoom = 1.9;
    controls.enableRotate = true;
    controls.update();
    camera.updateProjectionMatrix();
  }

  home();
  return {
    camera,
    controls,
    get mode() {
      return mode;
    },
    home,
    preset,
    setMode(value: CameraMode) {
      mode = value;
      orient();
    },
    focus(x: number, z: number) {
      controls.target.set(x, 0, z);
      camera.zoom = 5;
      orient();
      camera.updateProjectionMatrix();
    },
    zoom(factor: number) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.7, 16);
      camera.updateProjectionMatrix();
    },
    resize(width: number, height: number) {
      viewportAspect = width / Math.max(1, height);
      updateFrustum();
    },
    constrain() {
      const previous = controls.target.clone();
      controls.target.x = THREE.MathUtils.clamp(previous.x, sw.x, ne.x);
      controls.target.z = THREE.MathUtils.clamp(previous.z, ne.z, sw.z);
      camera.position.add(controls.target.clone().sub(previous));
    },
  };
}
