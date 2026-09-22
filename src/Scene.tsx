import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { POINTS, POINT_NODE, WALKWAY, type PointId } from './data';

export type SceneHandle = { go: (id: PointId) => void; home: () => void; reset: () => void; zoom: (factor: number) => void; capture: () => string | null };
type Props = { onArrive: (id: PointId) => void; onUnavailable: () => void };
type Runtime = SceneHandle & { destroy: () => void };

export const IslandScene = forwardRef<SceneHandle, Props>(function IslandScene({ onArrive, onUnavailable }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Runtime | null>(null);
  const callbacks = useRef({ onArrive, onUnavailable });
  callbacks.current = { onArrive, onUnavailable };
  useImperativeHandle(ref, () => ({
    go: id => engine.current ? engine.current.go(id) : callbacks.current.onArrive(id),
    home: () => engine.current?.home(), reset: () => engine.current?.reset(), zoom: factor => engine.current?.zoom(factor),
    capture: () => engine.current?.capture() ?? null,
  }), []);
  useEffect(() => {
    try { engine.current = createIsland(host.current!, id => callbacks.current.onArrive(id), () => callbacks.current.onUnavailable()); }
    catch { callbacks.current.onUnavailable(); }
    return () => { engine.current?.destroy(); engine.current = null; };
  }, []);
  return <div ref={host} className="scene" aria-label="东岙海湾三维场景" />;
});

function createIsland(host: HTMLDivElement, arrive: (id: PointId) => void, unavailable: () => void): Runtime {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#8CD2D7');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '可环视的海岛地图');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8CD2D7');
  const camera = new THREE.OrthographicCamera(-50, 50, 40, -40, 0.1, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2.65;
  controls.minZoom = 0.65;
  controls.maxZoom = 2.1;
  controls.rotateSpeed = 0.55;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  controls.enableDamping = !reduced.matches;
  const setHome = () => {
    camera.position.set(42, 70, 86);
    controls.target.set(0, 0, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix(); controls.update();
  };
  setHome();
  scene.add(new THREE.HemisphereLight('#fff9ec', '#648f94', 2.4));
  const sun = new THREE.DirectionalLight('#fff4d6', 3.1);
  sun.position.set(-30, 65, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 180 });
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.0003;
  scene.add(sun);

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const own = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeo = own(new THREE.IcosahedronGeometry(1, 0));
  const cylinderGeo = own(new THREE.CylinderGeometry(1, 1, 1, 10));
  const coneGeo = own(new THREE.ConeGeometry(1, 1, 7));
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.88, flatShading: true }));
    return materials.get(color)!;
  };
  function mesh(g: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, parent: THREE.Object3D = scene) {
    const m = new THREE.Mesh(g, material(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (color: string, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = scene) => mesh(boxGeo, color, x, y, z, w, h, d, parent);
  const rock = (color: string, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = scene) => mesh(sphereGeo, color, x, y, z, w, h, d, parent);
  let seed = 14;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const waterGeo = own(new THREE.PlaneGeometry(600, 600, 1, 1));
  const water = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float time;
      void main(){vec2 p=vUv*600.; float wave=sin(p.y*1.2+sin(p.x*.18+time*.15)*1.2+time*.7);
      float crest=smoothstep(.97,1.,wave)*smoothstep(.4,.8,sin(p.x*.35-p.y*.08));
      vec3 col=vec3(.37,.74,.78)+sin(p.y*.15+time*.2)*.009;
      gl_FragColor=vec4(col+crest*.065,1.);}`,
  });
  const ocean = new THREE.Mesh(waterGeo, water); ocean.rotation.x = -Math.PI / 2; ocean.position.y = -0.7; scene.add(ocean);

  const coast: [number, number][] = [[-34, 0], [-30, -18], [-19, -27], [4, -29], [23, -23], [33, -9], [33, 4], [27, 18], [18, 23], [9, 19], [2, 10], [-8, 10], [-15, 18], [-28, 19], [-33, 10]];
  function land(points: [number, number][], color: string, elevation: number, depth: number, scale = 1) {
    const s = new THREE.Shape(); points.forEach(([x, z], i) => i ? s.lineTo(x * scale, -z * scale) : s.moveTo(x * scale, -z * scale)); s.closePath();
    const geo = own(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.5, bevelSegments: 1, steps: 1 }));
    const m = new THREE.Mesh(geo, material(color)); m.rotation.x = -Math.PI / 2; m.position.y = elevation; m.receiveShadow = true; m.castShadow = true; scene.add(m);
  }
  land(coast, '#c4c8b3', -0.3, 0.6, 1.03);
  land(coast, '#e3d6a4', 0.1, 0.5);
  land([[-32, -1], [-28, -18], [-18, -25], [4, -27], [23, -21], [30, -8], [29, 2], [21, 9], [9, 5], [-3, 4], [-13, 10], [-28, 11]], '#83aa79', 0.65, 0.35);
  for (let i = 0; i < 15; i++) {
    const x = -25 + random() * 51, z = -20 - random() * 5;
    rock(i % 3 ? '#799f72' : '#94b387', x, 1.9, z, 5 + random() * 5, 3 + random() * 5, 4 + random() * 4);
  }
  const roadMat = material('#eeead6');
  function road(a: [number, number], b: [number, number], width: number) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const m = new THREE.Mesh(boxGeo, roadMat); m.position.set((a[0] + b[0]) / 2, 1.58, (a[1] + b[1]) / 2);
    m.scale.set(width, 0.14, Math.hypot(dx, dz)); m.rotation.y = Math.atan2(dx, dz); m.receiveShadow = true; scene.add(m);
    mesh(cylinderGeo, '#eeead6', a[0], 1.58, a[1], width / 2, 0.14, width / 2);
  }
  WALKWAY.slice(1).forEach((p, i) => road(WALKWAY[i], p, 2.6));
  road([-14, -9], [-17, -21], 2.1);
  road([2, -8], [0, -21], 2.1);
  road([-20, 8], [-26, 15], 2.2);
  // Stone quay follows the inner bay, with a timber jetty reaching the water.
  for (let i = 0; i < 18; i++) box('#bbc4ba', -13 + i * 1.2, 0.65, 9.8, 1.1, 1.5, 0.65);
  box('#d1b58a', -5, 0.55, 17, 3.1, 0.45, 14);
  for (let i = 0; i < 14; i++) box('#bca080', -5, 0.8, 10.5 + i, 3.12, 0.07, 0.12);
  for (const x of [-6.6, -3.4]) for (const z of [11, 17, 23]) mesh(cylinderGeo, '#657e79', x, 0.7, z, 0.22, 3, 0.22);
  box('#d5c9b3', -20, 1.18, 8, 10, 0.16, 7);
  for (let i = 0; i < 5; i++) box('#c4bca9', -24 + i * 2, 1.28, 8, 0.05, 0.02, 7);

  const roofGeo = own(new THREE.BufferGeometry());
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5,0,-0.5, 0.5,0,-0.5, 0,0.5,-0.5, -0.5,0,0.5, 0,0.5,0.5, 0.5,0,0.5,
    -0.5,0,-0.5, 0,0.5,-0.5, 0,0.5,0.5, -0.5,0,-0.5, 0,0.5,0.5, -0.5,0,0.5,
    0.5,0,-0.5, 0.5,0,0.5, 0,0.5,0.5, 0.5,0,-0.5, 0,0.5,0.5, 0,0.5,-0.5,
  ], 3)); roofGeo.computeVertexNormals();
  function house(x: number, z: number, w: number, d: number, h: number, color = '#d3d4c5', roof = '#637c7c', rotation = 0) {
    const g = new THREE.Group(); g.position.set(x, 1.15, z); g.rotation.y = rotation; scene.add(g);
    box(color, 0, h / 2, 0, w, h, d, g);
    mesh(roofGeo, roof, 0, h, 0, w + 0.8, 2.5, d + 0.9, g);
    box('#81908a', 0, 0.2, d / 2 + 0.05, w, 0.4, 0.22, g);
    box('#567879', 0, 1.15, d / 2 + 0.04, 1.1, 2.25, 0.12, g);
    for (const wx of [-w * 0.29, w * 0.29]) {
      box('#f7f1df', wx, h * 0.62, d / 2 + 0.09, 1.25, 1.65, 0.15, g);
      box('#527d82', wx, h * 0.62, d / 2 + 0.2, 0.85, 1.2, 0.12, g);
      box('#e2ddd0', wx, h * 0.62, d / 2 + 0.3, 0.09, 1.3, 0.1, g);
      box('#e2ddd0', wx, h * 0.62, d / 2 + 0.3, 0.9, 0.08, 0.1, g);
    }
    for (let row = 0; row < Math.floor(h); row++) {
      for (let j = 0; j < 4; j++) {
        const bx = -w / 2 + (j + 0.5) * w / 4;
        box(row % 2 ? '#bec4ba' : '#c4c9bf', bx, row + 0.4, -d / 2 - 0.03, w / 4 - 0.12, 0.7, 0.06, g);
      }
    }
    box(roof, w * 0.27, h + 0.9, -d * 0.22, 0.6, 1.7, 0.65, g);
    return g;
  }
  house(-25, -8, 5.5, 5, 4.4);
  house(-22, -16, 5, 5, 5.5, '#c3c7be', '#728680', 0.15);
  house(-8, -16, 6, 5, 5.2);
  house(-5, -4, 4.4, 4, 3.6, '#e7e3cd', '#858e7d');
  house(5, -19, 5.7, 5, 4.4);
  house(13, -16, 5.3, 5, 4, '#d8d8c4', '#71847b');
  house(-28, 1, 4, 4, 3.1, '#d6d7c8', '#7f918b');
  const inn = house(24, -14, 7, 6, 6.4, '#f4eee0', '#4f8992');
  box('#b19b7a', 0, 3.5, 3.8, 7.1, 0.2, 1.8, inn);
  for (let i = -3; i <= 3; i++) box('#fff5df', i, 4.1, 4.55, 0.12, 1.2, 0.12, inn);
  box('#fff5df', 0, 4.7, 4.55, 7, 0.13, 0.13, inn);
  const bistro = house(4, -3, 6, 4.4, 3.8, '#e6dfc4', '#bd7665', Math.PI);
  for (let i = 0; i < 6; i++) box(i % 2 ? '#fff1cf' : '#e9886c', -2.5 + i, 2.7, 3.15, 1, 0.12, 2, bistro).rotation.x = 0.1;
  for (const x of [-0.2, 7.3]) {
    mesh(cylinderGeo, '#f4e0a1', x, 1.9, 2, 1, 0.15, 1);
    mesh(cylinderGeo, '#6f8475', x, 1.4, 2, 0.12, 1.3, 0.12);
    for (const z of [0.5, 3.5]) box('#668b79', x, 1.5, z, 0.8, 0.8, 0.8);
  }
  // Ancient alley gate and fish-lantern poles.
  for (const x of [-16, -12]) box('#a5ada3', x, 3.6, -5, 0.6, 5, 0.6);
  box('#a5ada3', -14, 5.8, -5, 5.8, 0.6, 1.1);
  box('#637e7a', -14, 6.2, -5, 6.2, 0.3, 1.4);
  function lantern(x: number, z: number, color: string) {
    mesh(cylinderGeo, '#6f8277', x, 3, z, 0.13, 4, 0.13);
    box('#6f8277', x + 0.6, 5, z, 1.5, 0.12, 0.12);
    rock(color, x + 1.1, 4.4, z, 0.75, 0.5, 0.4);
    mesh(coneGeo, color, x + 1.95, 4.4, z, 0.45, 0.6, 0.3).rotation.z = Math.PI / 2;
    rock('#fff2ba', x + 0.8, 4.5, z + 0.35, 0.1, 0.1, 0.1);
    box('#e2b754', x + 1.1, 3.7, z, 0.06, 0.65, 0.06);
  }
  lantern(-24, 5, '#ed765e'); lantern(-19, 4, '#f2c85a'); lantern(-16, 7, '#ed765e');

  function tree(x: number, z: number, size: number) {
    mesh(cylinderGeo, '#8b8f72', x, 1.7 * size, z, 0.2 * size, 3 * size, 0.2 * size);
    rock('#618d63', x, 3.7 * size, z, 1.7 * size, 2.3 * size, 1.6 * size);
    rock('#78a36c', x - 0.5 * size, 4.7 * size, z, 1.3 * size, 1.6 * size, 1.25 * size);
  }
  for (const [x, z, size] of [[-29,-13,1],[-27,-20,1.1],[-17,-23,1.3],[-11,-22,1],[-2,-23,1.2],[9,-24,1.1],[18,-20,1],[29,-10,1.2],[28,-3,.9],[-31,6,.8],[16,3,.75],[27,6,1],[-10,3,.8]]) tree(x, z, size);
  for (let i = 0; i < 28; i++) {
    const x = -30 + random() * 60, z = -26 + random() * 5;
    rock('#668d69', x, 1.4, z, 0.7 + random(), 0.6 + random(), 0.7 + random());
  }
  for (let i = 0; i < 10; i++) rock('#a3b4a9', 25 + random() * 9, 0.2, 14 + random() * 7, 1 + random() * 2, 0.8 + random(), 1 + random());
  // Beach parasols, chairs, and shells are built from reusable primitives.
  for (const [x, z, color] of [[15, 15, '#ed765e'], [20, 17, '#f2c85a']] as const) {
    mesh(cylinderGeo, '#a7a387', x, 2, z, 0.08, 3, 0.08);
    mesh(coneGeo, color, x, 3.6, z, 2.1, 0.8, 2.1);
    box('#fff2d7', x + 1, 1, z + 1, 0.8, 0.13, 1.8).rotation.y = -0.3;
  }
  for (let i = 0; i < 16; i++) rock('#faf0dc', 10 + random() * 12, 0.85, 13 + random() * 6, 0.2, 0.12, 0.25);
  const boats: THREE.Group[] = [];
  function boat(x: number, z: number, color: string, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, -0.15, z); g.scale.setScalar(scale); scene.add(g); boats.push(g);
    const hull = mesh(sphereGeo, color, 0, 0.3, 0, 1.4, 0.65, 3.8, g); hull.rotation.y = 0.05;
    box('#edd6a7', 0, 0.85, 0, 1.7, 0.15, 4, g);
    box('#faf1d9', 0, 1.55, -0.6, 1.6, 1.35, 1.55, g);
    box('#5f959b', 0, 2.3, -0.6, 1.95, 0.18, 1.85, g);
    box('#4c7c86', 0, 1.8, 0.21, 1.1, 0.55, 0.06, g);
    mesh(cylinderGeo, '#927f63', 0, 3, 0.9, 0.07, 5, 0.07, g);
    box('#f2c85a', 0.45, 5.3, 0.9, 0.9, 0.55, 0.06, g);
    for (const xx of [-1, 1]) mesh(cylinderGeo, '#506868', xx, 0.7, 0.4, 0.32, 0.18, 0.32, g).rotation.z = Math.PI / 2;
    g.rotation.y = -0.35;
  }
  boat(-10, 24, '#ed765e', 1); boat(1, 20, '#41878f', 0.85); boat(-20, 33, '#f2c85a', 0.65);
  // Small offshore rock and beacon anchor the composition.
  rock('#94a49b', 38, 0, 29, 5.5, 2, 4.2);
  mesh(cylinderGeo, '#fff0d9', 38, 4, 29, 1.1, 6, 1.1);
  mesh(cylinderGeo, '#ed765e', 38, 5.3, 29, 1.13, 1.3, 1.13);
  mesh(cylinderGeo, '#516f73', 38, 7.2, 29, 1.4, 0.3, 1.4);
  mesh(cylinderGeo, '#f2c85a', 38, 7.8, 29, 0.7, 1, 0.7);
  mesh(coneGeo, '#ed765e', 38, 8.5, 29, 1.3, 0.9, 1.3);

  const player = new THREE.Group(); scene.add(player); player.position.set(-20, 1.4, 8);
  mesh(cylinderGeo, '#f4c35b', 0, 1.25, 0, 0.42, 1.1, 0.35, player);
  rock('#eac6a1', 0, 2.05, 0, 0.42, 0.48, 0.42, player);
  mesh(cylinderGeo, '#fff4d6', 0, 2.48, 0, 0.68, 0.11, 0.68, player);
  mesh(cylinderGeo, '#eadcae', 0, 2.61, 0, 0.4, 0.3, 0.4, player);
  box('#dd795d', 0, 1.25, -0.4, 0.6, 0.7, 0.3, player);
  const legs = [-0.2, 0.2].map(x => box('#546f79', x, 0.5, 0, 0.26, 0.65, 0.28, player));
  const haloGeo = own(new THREE.RingGeometry(0.75, 0.92, 28));
  const haloMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const halo = new THREE.Mesh(haloGeo, haloMat); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; player.add(halo);
  const rings = POINTS.map(p => {
    const g = own(new THREE.RingGeometry(1.1, 1.3, 32));
    const m = new THREE.Mesh(g, material(p.color)); m.rotation.x = -Math.PI / 2; m.position.set(p.position[0], 1.68, p.position[1]); scene.add(m); return m;
  });

  let width = 1, height = 1, frame = 0, last = 0, time = 0, destroyed = false, lost = false;
  let route: THREE.Vector3[] = [], destination: PointId | null = null;
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight;
    renderer.setSize(width, height);
    const aspect = width / Math.max(height, 1);
    const extent = aspect < 0.8 ? 46 / aspect : 45;
    camera.left = -extent * aspect; camera.right = extent * aspect;
    camera.top = extent; camera.bottom = -extent; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const projection = new THREE.Vector3();
  const updateLabels = () => {
    POINTS.forEach(p => {
      const label = document.getElementById(`pin-${p.id}`);
      if (!label) return;
      projection.set(p.position[0], 3.8, p.position[1]).project(camera);
      label.style.left = `${(projection.x * 0.5 + 0.5) * width}px`;
      label.style.top = `${(-projection.y * 0.5 + 0.5) * height}px`;
      label.style.visibility = projection.z > 1 ? 'hidden' : 'visible';
    });
  };
  const finish = () => { if (destination) { const id = destination; destination = null; arrive(id); } };
  function render(now: number) {
    if (destroyed || lost || document.hidden) return;
    const dt = Math.min((now - last) / 1000 || 0, 0.05); last = now;
    if (!reduced.matches) time += dt;
    water.uniforms.time.value = time;
    boats.forEach((b, i) => { b.rotation.z = Math.sin(time * 1.3 + i) * 0.035; b.position.y = -0.1 + Math.sin(time * 1.1 + i) * 0.12; });
    if (route.length) {
      const target = route[0]; const distance = player.position.distanceTo(target);
      if (distance < 0.18) { player.position.copy(target); route.shift(); if (!route.length) finish(); }
      else { const direction = target.clone().sub(player.position).normalize(); player.position.addScaledVector(direction, Math.min(distance, dt * 17)); player.rotation.y = Math.atan2(direction.x, direction.z); }
      legs.forEach((leg, i) => { leg.rotation.x = Math.sin(time * 15 + i * Math.PI) * 0.5; });
    } else legs.forEach(leg => { leg.rotation.x = 0; });
    controls.update(); updateLabels(); renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }
  const visibility = () => { cancelAnimationFrame(frame); last = 0; if (!document.hidden) frame = requestAnimationFrame(render); };
  document.addEventListener('visibilitychange', visibility);
  const contextLost = (e: Event) => { e.preventDefault(); lost = true; cancelAnimationFrame(frame); unavailable(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  frame = requestAnimationFrame(render);
  return {
    go(id) {
      if (lost) { arrive(id); return; }
      const targetNode = POINT_NODE[id];
      if (reduced.matches) { player.position.set(...[WALKWAY[targetNode][0], 1.4, WALKWAY[targetNode][1]] as [number, number, number]); route = []; destination = null; arrive(id); return; }
      let nearest = 0, nearestDistance = Infinity;
      WALKWAY.forEach(([x, z], i) => { const d = Math.hypot(player.position.x - x, player.position.z - z); if (d < nearestDistance) { nearest = i; nearestDistance = d; } });
      const indices: number[] = [nearest];
      while (nearest !== targetNode) { nearest += Math.sign(targetNode - nearest); indices.push(nearest); }
      route = indices.map(i => new THREE.Vector3(WALKWAY[i][0], 1.4, WALKWAY[i][1])); destination = id;
    },
    home: setHome,
    reset() { route = []; destination = null; player.position.set(-20, 1.4, 8); player.rotation.y = 0; setHome(); },
    zoom(factor) { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); },
    capture() { if (lost) return null; renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    destroy() {
      destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); water.dispose(); haloMat.dispose();
      rings.length = 0; renderer.dispose(); renderer.domElement.remove();
    },
  };
}
