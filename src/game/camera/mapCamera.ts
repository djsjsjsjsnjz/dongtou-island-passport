import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GEO_CONFIG } from "../geo/geoConfig";
import { geoToWorld } from "../geo/coordinates";
export type CameraMode = "top" | "oblique";
export function createMapCamera(canvas: HTMLCanvasElement) {
  const camera = new THREE.OrthographicCamera(
    -1200,
    1200,
    1200,
    -1200,
    1,
    12000,
  );
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.minZoom = 0.6;
  controls.maxZoom = 14;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.minPolarAngle = 0;
  const sw = geoToWorld(GEO_CONFIG.bbox[1], GEO_CONFIG.bbox[0]),
    ne = geoToWorld(GEO_CONFIG.bbox[3], GEO_CONFIG.bbox[2]);
  let mode: CameraMode = "top";
  const configure = () => {
    controls.enableRotate = mode === "oblique";
    controls.mouseButtons.LEFT =
      mode === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE =
      mode === "top" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    camera.up.set(0, 1, 0);
    const t = controls.target;
    camera.position.set(t.x, t.y + 3000, t.z + (mode === "top" ? 0.001 : 1800));
    controls.update();
  };
  const setMode = (value: CameraMode) => {
    mode = value;
    configure();
  };
  const home = () => {
    controls.target.set(0, 0, 0);
    camera.zoom = 1;
    configure();
    camera.updateProjectionMatrix();
  };
  home();
  return {
    camera,
    controls,
    setMode,
    home,
    focus(x: number, z: number) {
      controls.target.set(x, 0, z);
      camera.zoom = 3;
      configure();
      camera.updateProjectionMatrix();
    },
    zoom(factor: number) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.6, 14);
      camera.updateProjectionMatrix();
    },
    resize(width: number, height: number) {
      const aspect = width / Math.max(1, height);
      const extent = 1150 / Math.min(1, aspect);
      camera.left = -extent * aspect;
      camera.right = extent * aspect;
      camera.top = extent;
      camera.bottom = -extent;
      camera.updateProjectionMatrix();
    },
    constrain() {
      const old = controls.target.clone();
      controls.target.x = THREE.MathUtils.clamp(old.x, sw.x, ne.x);
      controls.target.z = THREE.MathUtils.clamp(old.z, ne.z, sw.z);
      controls.target.y = 0;
      camera.position.add(controls.target.clone().sub(old));
    },
  };
}
