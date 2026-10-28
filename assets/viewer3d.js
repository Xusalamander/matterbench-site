// 拼豆灯罩的 3D 预览。加载完挂 window.MB3D,并派发 mb3d-ready。
// 尺寸是相对单位:1 格 = 1 颗拼豆。灯罩四面围成方筒,里面四块 8×8 灯板,底座上一块 ESP32。
// demo.js 调 setLamp() 换图案,每帧调 setLight() 换颜色。
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const F = 4, N = 16, LED = 8;
const HALF = N / 2 + 0.45;      // 面到中心的距离
const BASE = 1.5;               // 底座高
const OUTER = 0.46, HOLE = 0.2, LEN = 0.9;
const THEMES = {
  dark: { bg: 0x141519, floor: 0x1b1d22, grid1: 0x3a3d45, grid2: 0x24262c },
  light: { bg: 0xECECE6, floor: 0xE2E2DB, grid1: 0xc4c4bb, grid2: 0xd6d6cf },
};
const NIGHT_BG = 0x050608;

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
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  hemi = new THREE.HemisphereLight(0xffffff, 0x404048, 1.4);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(30, 60, 45);
  scene.add(sun);
  glow = new THREE.PointLight(0xffb65c, 0, 80, 1.6); // 开灯时从灯罩里照到桌面
  glow.position.set(0, BASE + N / 2, 0);
  scene.add(glow);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;

  // 桌面
  floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: THEMES.dark.floor, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // 底座 + ESP32
  const base = new THREE.Mesh(new THREE.BoxGeometry(N + 2.4, BASE, N + 2.4), new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.7 }));
  base.position.y = BASE / 2;
  scene.add(base);
  const esp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 5.2), new THREE.MeshStandardMaterial({ color: 0x1f6f4a, roughness: 0.6 }));
  esp.position.set(0, BASE + 0.13, 0);
  scene.add(esp);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.8), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.3 }));
  chip.position.set(0, BASE + 0.4, -1);
  scene.add(chip);

  // 四块灯板(贴图 8×8,线性插值 = 天然的柔光)
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

  // 拼豆:空心短管,轴朝外
  const r0 = HOLE, r1 = OUTER, h = LEN / 2, e = 0.04;
  const profile = [[r0, -h], [r1 - e, -h], [r1, -h + e], [r1, h - e], [r1 - e, h], [r0, h], [r0, -h]].map(([x, y]) => new THREE.Vector2(x, y));
  matDay = new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide });
  matNight = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  beads = new THREE.InstancedMesh(new THREE.LatheGeometry(profile, 24), matDay, F * N * N);
  beads.frustumCulled = false; // 实例远离原点,包围球会算错
  beads.count = 0;
  scene.add(beads);

  // 左下角坐标轴
  gizmoScene = new THREE.Scene();
  gizmoCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  for (const [x, y, z, col] of [[1, 0, 0, "#E5484D"], [0, 1, 0, "#2BB0C9"], [0, 0, 1, "#9BD43A"]]) {
    gizmoScene.add(new THREE.ArrowHelper(new THREE.Vector3(x, y, z), new THREE.Vector3(), 1, new THREE.Color(col), 0.28, 0.14));
  }
  tick();
}

function tick() { requestAnimationFrame(tick); draw(); }
// 场景一变就先画一帧(后台标签页里动画帧会停)
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
  camera.near = d / 100; camera.far = d * 20;
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

// 第 f 面第 (x, y) 格在世界里的位置。展开图从左到右:前、右、后、左,y 从上往下
function cellPos(f, x, y, out) {
  const u = x + 0.5 - N / 2, wy = BASE + (N - 1 - y) + 0.5;
  if (f === 0) return out.set(u, wy, HALF);
  if (f === 1) return out.set(HALF, wy, -u);
  if (f === 2) return out.set(-u, wy, -HALF);
  return out.set(-HALF, wy, u);
}

// 换图案:o = { cells: (string|null)[F*N*N], theme, grid }
function setLamp(o) {
  theme = o.theme === "light" ? "light" : "dark";
  const t = THEMES[theme];
  if (!night) scene.background = new THREE.Color(t.bg);
  floor.material.color.setHex(t.floor);

  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
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

// 开灯 / 关灯。on 时:cellRGB = 每格透光后的颜色(0–1,F*N*N*3),ledRGB = 每颗灯珠颜色(0–1,F*LED*LED*3)
function setLight(on, cellRGB, ledRGB, dayCells) {
  night = on;
  scene.background = new THREE.Color(on ? NIGHT_BG : THEMES[theme].bg);
  hemi.intensity = on ? 0.08 : 1.4;
  sun.intensity = on ? 0.0 : 1.5;
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
      sr += r; sg += g; sb += b;
      const o = ((LED - 1 - ly) * LED + lx) * 4; // 贴图第 0 行在底下
      data[o] = r * 255; data[o + 1] = g * 255; data[o + 2] = b * 255; data[o + 3] = 255;
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
