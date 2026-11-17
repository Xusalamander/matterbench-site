import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const F = 4, N = 16, LED = 8;
const HALF = N / 2 + 0.45;
const BASE = 1.5;
const OUTER = 0.46, HOLE = 0.2, LEN = 0.9;
const THEMES = {
  dark: { bg: 1316121, floor: 1776930, grid1: 3816773, grid2: 2369068 },
  light: { bg: 15527142, floor: 14869211, grid1: 12895419, grid2: 14079695 }
};
const NIGHT_BG = 329224;
let renderer, scene, camera, controls, host = null, ro = null;
let beads, matDay, matNight, cellOf = [], floor, grid = null, hemi, sun, glow;
let panels = [], panelTex = [], theme = "dark", night = false, fitted = false;
let gizmoScene, gizmoCam;
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2e3);
  hemi = new THREE.HemisphereLight(16777215, 4210760, 1.4);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(16777215, 1.5);
  sun.position.set(30, 60, 45);
  scene.add(sun);
  glow = new THREE.PointLight(16758364, 0, 80, 1.6);
  glow.position.set(0, BASE + N / 2, 0);
  scene.add(glow);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: THEMES.dark.floor, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const base = new THREE.Mesh(new THREE.BoxGeometry(N + 2.4, BASE, N + 2.4), new THREE.MeshStandardMaterial({ color: 2764084, roughness: 0.7 }));
  base.position.y = BASE / 2;
  scene.add(base);
  const esp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 5.2), new THREE.MeshStandardMaterial({ color: 2060106, roughness: 0.6 }));
  esp.position.set(0, BASE + 0.13, 0);
  scene.add(esp);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.8), new THREE.MeshStandardMaterial({ color: 12106948, metalness: 0.6, roughness: 0.3 }));
  chip.position.set(0, BASE + 0.4, -1);
  scene.add(chip);
  for (let f = 0; f < F; f++) {
    const data = new Uint8Array(LED * LED * 4).fill(40);
    const tex = new THREE.DataTexture(data, LED, LED, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const d = HALF - 1.4;
    m.position.y = BASE + N / 2;
    m.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][f];
    m.position.x = [0, d, 0, -d][f];
    m.position.z = [d, 0, -d, 0][f];
    scene.add(m);
    panels.push(m);
    panelTex.push(tex);
  }
  const r0 = HOLE, r1 = OUTER, h = LEN / 2, e = 0.04;
  const profile = [[r0, -h], [r1 - e, -h], [r1, -h + e], [r1, h - e], [r1 - e, h], [r0, h], [r0, -h]].map(([x, y]) => new THREE.Vector2(x, y));
  matDay = new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide });
  matNight = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  beads = new THREE.InstancedMesh(new THREE.LatheGeometry(profile, 24), matDay, F * N * N);
  beads.frustumCulled = false;
  beads.count = 0;
  scene.add(beads);
  gizmoScene = new THREE.Scene();
  gizmoCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  for (const [x, y, z, col] of [[1, 0, 0, "#E5484D"], [0, 1, 0, "#2BB0C9"], [0, 0, 1, "#9BD43A"]]) {
    gizmoScene.add(new THREE.ArrowHelper(new THREE.Vector3(x, y, z), new THREE.Vector3(), 1, new THREE.Color(col), 0.28, 0.14));
  }
  tick();
}
function tick() {
  requestAnimationFrame(tick);
  draw();
}
function draw() {
  if (!host || !host.isConnected || host.offsetParent === null) return;
  controls.update();
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setViewport(0, 0, w, h);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(scene, camera);
  const g = 84;
  gizmoCam.position.copy(camera.position).sub(controls.target).setLength(4);
  gizmoCam.lookAt(0, 0, 0);
  renderer.setScissorTest(true);
  renderer.setScissor(8, 8, g, g);
  renderer.setViewport(8, 8, g, g);
  renderer.clearDepth();
  renderer.render(gizmoScene, gizmoCam);
  renderer.setScissorTest(false);
}
function resize() {
  if (!host) return;
  const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + "px";
  renderer.domElement.style.height = h + "px";
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!fitted) fit();
  draw();
}
function fit() {
  fitted = true;
  const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const d = 15.5 / Math.sin(Math.min(vHalf, hHalf));
  controls.target.set(0, BASE + N / 2 - 1, 0);
  camera.position.copy(controls.target).add(new THREE.Vector3(0.62, 0.42, 1).normalize().multiplyScalar(d));
  camera.near = d / 100;
  camera.far = d * 20;
  camera.updateProjectionMatrix();
  controls.update();
}
function mount(el) {
  if (!renderer) init();
  if (host !== el) {
    host = el;
    el.appendChild(renderer.domElement);
    ro?.disconnect();
    ro = new ResizeObserver(resize);
    ro.observe(el);
  }
  resize();
}
function cellPos(f, x, y, out) {
  const u = x + 0.5 - N / 2, wy = BASE + (N - 1 - y) + 0.5;
  if (f === 0) return out.set(u, wy, HALF);
  if (f === 1) return out.set(HALF, wy, -u);
  if (f === 2) return out.set(-u, wy, -HALF);
  return out.set(-HALF, wy, u);
}
function setLamp(o) {
  theme = o.theme === "light" ? "light" : "dark";
  const t = THEMES[theme];
  if (!night) scene.background = new THREE.Color(t.bg);
  floor.material.color.setHex(t.floor);
  if (grid) {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
    grid = null;
  }
  if (o.grid) {
    grid = new THREE.GridHelper(64, 32, t.grid1, t.grid2);
    grid.position.y = 0.01;
    scene.add(grid);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const qFB = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const qLR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const col = new THREE.Color();
  cellOf = [];
  let k = 0;
  for (let f = 0; f < F; f++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = f * N * N + y * N + x, c = o.cells[i];
    if (!c) continue;
    q.copy(f % 2 === 0 ? qFB : qLR);
    m.compose(cellPos(f, x, y, p), q, one);
    beads.setMatrixAt(k, m);
    beads.setColorAt(k, col.set(c));
    cellOf.push(i);
    k++;
  }
  beads.count = k;
  beads.instanceMatrix.needsUpdate = true;
  if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
  matDay.needsUpdate = true;
  matNight.needsUpdate = true;
  draw();
}
function setLight(on, cellRGB, ledRGB, dayCells) {
  night = on;
  scene.background = new THREE.Color(on ? NIGHT_BG : THEMES[theme].bg);
  hemi.intensity = on ? 0.08 : 1.4;
  sun.intensity = on ? 0 : 1.5;
  beads.material = on ? matNight : matDay;
  const col = new THREE.Color();
  for (let k = 0; k < cellOf.length; k++) {
    const i = cellOf[k];
    if (on) col.setRGB(cellRGB[i * 3], cellRGB[i * 3 + 1], cellRGB[i * 3 + 2], THREE.SRGBColorSpace);
    else col.set(dayCells[i]);
    beads.setColorAt(k, col);
  }
  if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
  let sr = 0, sg = 0, sb = 0;
  for (let f = 0; f < F; f++) {
    const data = panelTex[f].image.data;
    for (let ly = 0; ly < LED; ly++) for (let lx = 0; lx < LED; lx++) {
      const j = (f * LED * LED + ly * LED + lx) * 3;
      const r = on ? ledRGB[j] : 0.12, g = on ? ledRGB[j + 1] : 0.12, b = on ? ledRGB[j + 2] : 0.13;
      sr += r;
      sg += g;
      sb += b;
      const o = ((LED - 1 - ly) * LED + lx) * 4;
      data[o] = r * 255;
      data[o + 1] = g * 255;
      data[o + 2] = b * 255;
      data[o + 3] = 255;
    }
    panelTex[f].needsUpdate = true;
  }
  const n = F * LED * LED;
  glow.color.setRGB(sr / n, sg / n, sb / n, THREE.SRGBColorSpace);
  glow.intensity = on ? 900 * Math.max(sr, sg, sb) / n : 0;
  draw();
}
window.MB3D = { mount, setLamp, setLight };
window.dispatchEvent(new Event("mb3d-ready"));
