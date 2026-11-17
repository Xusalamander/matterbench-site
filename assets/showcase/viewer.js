(() => {
  "use strict";
  const el = document.querySelector("[data-showcase]");
  if (!el) return;
  const fail = () => {
    el.classList.add("is-fallback");
  };
  if (typeof THREE === "undefined" || !window.MBLattice || !window.MBLampCore) {
    fail();
    return;
  }
  const L = window.MBLattice, QMM = L.QMM, CORE = window.MBLampCore, LED = CORE.LED;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    fail();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0E0F12");
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 3e3);
  scene.add(new THREE.HemisphereLight(16777215, 7829367, 0.5));
  const sun = new THREE.DirectionalLight(16777215, 0.34);
  sun.position.set(120, 260, 80);
  scene.add(sun);
  const U = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)];
  const L2T = (a) => new THREE.Vector3(a[0] * QMM, a[2] * QMM, a[1] * QMM);
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: new THREE.Color(c), side: THREE.DoubleSide });
  const mats = { rod: lambert("#3FBFAE"), strip: lambert("#E8935A"), clip: lambert("#9A90EA"), plate: lambert("#5A6661") };
  const beadMats = new Map();
  const beadMat = (c) => {
    if (!beadMats.has(c)) beadMats.set(c, lambert(c));
    return beadMats.get(c);
  };
  const baseMat = (p) => p.base ? mats.plate : p.type === "bead" ? beadMat(p.color || "#E5484D") : mats[p.type];
  function buildMesh(p, mat, baseboard) {
    if (p.base && !(p.R === 0 && p.c[1] === 0)) {
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      group.userData.base = new THREE.Matrix4();
      return group;
    }
    if (p.type === "pal") return buildPalMesh(p);
    if (p.type === "lamp") return buildLampMesh(p);
    const d = L.describe(p), A = p.A, m = new THREE.Matrix4();
    let geo, origin, xv, yv, zv;
    if (p.type === "rod") {
      geo = new THREE.CylinderGeometry(2.5, 2.5, p.n * 10, 20);
      geo.rotateX(Math.PI / 2);
      origin = L2T([0, 1, 2].map((t) => (d.min[t] + d.max[t]) / 2));
      zv = U[A];
      xv = U[(A + 1) % 3];
      yv = U[(A + 2) % 3];
    } else if (p.type === "bead") {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, 2.45, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 1.1, 0, Math.PI * 2, true);
      sh.holes.push(hole);
      geo = new THREE.ExtrudeGeometry(sh, { depth: p.n * 5, bevelEnabled: false, curveSegments: 18 });
      origin = L2T([0, 1, 2].map((t) => t === A ? d.min[t] : (d.min[t] + d.max[t]) / 2));
      zv = U[A];
      xv = U[(A + 1) % 3];
      yv = U[(A + 2) % 3];
      if (new THREE.Vector3().crossVectors(xv, yv).dot(zv) < 0) yv = yv.clone().negate();
    } else {
      const R = p.R, W = 3 - A - R, shape = new THREE.Shape(), o = [0, 0, 0];
      if (p.type === "strip") {
        const len = p.n * 10;
        shape.moveTo(0, -5);
        shape.lineTo(len, -5);
        shape.lineTo(len, 5);
        shape.lineTo(0, 5);
        shape.lineTo(0, -5);
        if (p.base) {
          shape.curves = [];
          shape.moveTo(0, -5);
          shape.lineTo(baseboard.columns * 10, -5);
          shape.lineTo(baseboard.columns * 10, baseboard.rows * 10 - 5);
          shape.lineTo(0, baseboard.rows * 10 - 5);
          shape.closePath();
        }
        for (let row = 0; row < (p.base ? baseboard.rows : 1); row++) for (let k = 0; k < p.n; k++) {
          const hp = new THREE.Path();
          hp.absarc(5 + 10 * k, row * 10, p.base ? 2.7 : 2.6, 0, Math.PI * 2, true);
          shape.holes.push(hp);
        }
        o[R] = d.min[R];
        o[W] = d.s0[W];
        o[A] = d.min[A];
        geo = new THREE.ExtrudeGeometry(shape, { depth: p.base ? 5 : QMM, bevelEnabled: false, curveSegments: 12 });
      } else {
        shape.moveTo(0, -4);
        shape.lineTo(10, -4);
        shape.absarc(10, 0, 4, -Math.PI / 2, Math.PI / 2, false);
        shape.lineTo(0, 4);
        shape.absarc(0, 0, 4, Math.PI / 2, Math.PI * 1.5, false);
        for (let k = 0; k < 2; k++) {
          const hp = new THREE.Path();
          hp.absarc(10 * k, 0, 2.4, 0, Math.PI * 2, true);
          shape.holes.push(hp);
        }
        o[R] = d.s0[R];
        o[W] = d.s0[W];
        o[A] = d.min[A];
        geo = new THREE.ExtrudeGeometry(shape, { depth: p.n * QMM, bevelEnabled: false, curveSegments: 12 });
      }
      origin = L2T(o);
      xv = U[R];
      yv = U[W];
      zv = U[A];
    }
    m.makeBasis(xv, yv, zv);
    m.setPosition(origin);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m);
    mesh.updateMatrixWorld(true);
    mesh.userData.base = m.clone();
    return mesh;
  }
  const tubeGeos = {};
  const tubeGeo = (axis) => {
    if (tubeGeos[axis]) return tubeGeos[axis];
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 2.45, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 1.1, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false, curveSegments: 14 });
    g.translate(0, 0, -2.5);
    if (axis === "y") g.rotateX(-Math.PI / 2);
    return tubeGeos[axis] = g;
  };
  const lampMats = {};
  const lampMat = (k, c) => lampMats[k] || (lampMats[k] = new THREE.MeshLambertMaterial({ color: c }));
  function buildPalMesh(p) {
    const N = L.PAL_N, group = new THREE.Group();
    const cx = 4 * p.c[0], cy = 4 * p.c[1], zb = 4 * p.c[2] + (p.s || 0);
    const cells = [];
    p.cells.forEach((row, r) => row.forEach((c, i) => {
      if (c) cells.push([i, r, c]);
    }));
    const day = new THREE.MeshLambertMaterial({ color: 16777215 });
    const inst = new THREE.InstancedMesh(tubeGeo("z"), day, cells.length), mm = new THREE.Matrix4(), col = new THREE.Color();
    cells.forEach(([i, r, c], k) => {
      mm.makeTranslation((cx - N + 2 * i + 1) * QMM, (zb + 2 * (N - 1 - r) + 1) * QMM, cy * QMM);
      inst.setMatrixAt(k, mm);
      inst.setColorAt(k, col.set(c));
    });
    group.add(inst);
    group.userData.beads = { inst, cells, day, night: new THREE.MeshBasicMaterial({ color: 16777215 }), lit: false };
    const holder = lampMat("holder", 10133670), Q = QMM;
    const add = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * Q, h * Q, d * Q), holder);
      m.position.set(x * Q, y * Q, z * Q);
      group.add(m);
    };
    const low = cells.filter(([, r]) => r >= N - 3), xs = low.map(([i]) => cx - N + 2 * i);
    const x0 = Math.min(cx - 5, ...xs), x1 = Math.max(cx + 5, ...xs.map((x) => x + 2));
    add(x1 - x0, 1.2, 1, (x0 + x1) / 2, zb + 0.6, cy - 1.5);
    for (const x of [Math.min(...xs) - 0.5, Math.max(...xs) + 2.5]) add(1, 6, 3, x, zb + 3, cy);
    for (const f of L.palFeet(p)) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, L.FOOT_Q * Q, 14), holder);
      m.position.set((cx + 4 * f) * Q, (zb - L.FOOT_Q / 2) * Q, cy * Q);
      group.add(m);
    }
    group.matrixAutoUpdate = false;
    group.userData.base = new THREE.Matrix4();
    return group;
  }
  const WIRE = { data: 4044907, power: 15026253, gnd: 1447965, button: 16110919 };
  function buildLampMesh(p) {
    const group = new THREE.Group(), Q = QMM, LM = L.LAMP;
    const cx = 4 * p.c[0], cy = 4 * p.c[1], zb = 4 * p.c[2] + (p.s || 0), top = zb + LM.base, mid = top + LM.panel / 2;
    const at = (x, y, z) => L2T([x, y, z]);
    const box = (w, h, d, material, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * Q, h * Q, d * Q), material);
      m.position.copy(at(x, y, z));
      group.add(m);
      return m;
    };
    box(2 * LM.half, LM.base, LM.back + 1, lampMat("base", 2764084), cx, cy - (LM.back - 1) / 2, zb + LM.base / 2);
    box(2 * LM.half, LM.panel, 1.1, lampMat("pcb", 1447965), cx, cy - 0.45, mid);
    const led = CORE.makeLedPanel(THREE, 2 * LM.half * Q - 1.5);
    led.mesh.position.copy(at(cx, cy + 0.8, mid));
    group.add(led.mesh);
    const esp = CORE.makeEsp32(THREE, 5);
    esp.rotation.y = Math.PI / 2;
    esp.position.copy(at(cx + 7, cy - 4.5, top));
    esp.updateMatrix();
    group.add(esp);
    box(4, 1, 4, lampMat("switch", 1447965), cx - 10, cy - 5, top + 0.5);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * Q, 1.2 * Q, Q, 16), lampMat("cap", 15026253));
    cap.position.copy(at(cx - 10, cy - 5, top + 1.5));
    group.add(cap);
    for (const f of [-3, 3]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, L.FOOT_Q * Q, 16), lampMat("foot", 9080728));
      foot.position.copy(at(cx + 4 * f, cy - 4, zb - L.FOOT_Q / 2));
      group.add(foot);
    }
    const pin = (k) => new THREE.Vector3(...esp.userData.pins[k]).applyMatrix4(esp.matrix);
    const wire = (a, b, color) => {
      const lift = Math.max(a.y, b.y) + 5, curve = new THREE.CatmullRomCurve3([a, new THREE.Vector3(a.x, lift, a.z), new THREE.Vector3(b.x, lift, b.z), b]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.55, 6, false), lampMat("wire" + color, color)));
    };
    const din = (x) => at(x, cy - 1, top + 2.5);
    wire(pin("data"), din(cx + 5), WIRE.data);
    wire(pin("data").add(new THREE.Vector3(0, 0, -1.6)), din(cx + 2), WIRE.power);
    wire(pin("gnd"), din(cx + 3.5), WIRE.gnd);
    wire(pin("button"), at(cx - 9, cy - 4, top + 1), WIRE.button);
    wire(pin("gnd").add(new THREE.Vector3(-1.6, 0, 0)), at(cx - 11, cy - 4, top + 1), WIRE.gnd);
    const glow = new THREE.PointLight(16758364, 0, 160);
    glow.position.copy(at(cx, cy + 10, mid));
    group.add(glow);
    group.userData.glow = glow;
    group.userData.tex = led.tex;
    group.matrixAutoUpdate = false;
    group.userData.base = new THREE.Matrix4();
    return group;
  }
  const world = new L.World(), meshes = new Map();
  let turning = [], lampSettings = { color: "#FFB65C", effect: "solid" };
  const drops = new Map();
  let lampOn = false, spinOn = false, spinAng = 0;
  const ledBufs = new WeakMap(), beadCol = new THREE.Color(), px = [0, 0, 0], DARK = [0.02, 0.02, 0.02];
  function lightLamps(t) {
    const lit = [];
    meshes.forEach((m) => {
      const p = m.userData.part;
      if (p.type !== "lamp" || !m.visible) return;
      const light = { fx: lampSettings.effect, color: lampSettings.color, bright: 85, speed: 4 };
      let buf = ledBufs.get(p);
      if (!buf) ledBufs.set(p, buf = new Float32Array(LED * LED * 3));
      if (lampOn) for (let ly = 0; ly < LED; ly++) for (let lx = 0; lx < LED; lx++) {
        const c = CORE.ledAt(light, 0, lx, ly, t, 1), j = (ly * LED + lx) * 3;
        buf[j] = c[0];
        buf[j + 1] = c[1];
        buf[j + 2] = c[2];
      }
      const [r, g, b] = CORE.paintPanel(m.userData.tex, buf, lampOn);
      m.userData.glow.color.setRGB(r, g, b);
      m.userData.glow.intensity = lampOn ? 2.6 * Math.max(r, g, b) : 0;
      if (lampOn) lit.push({ p, buf });
    });
    meshes.forEach((m) => {
      const b = m.userData.beads;
      if (!b) return;
      const p = m.userData.part, gap = (l) => p.c[1] - l.p.c[1];
      const lamp = lit.find((l) => gap(l) >= 1 && gap(l) <= 3 && Math.abs(l.p.c[0] - p.c[0]) <= 3);
      if (!lamp) {
        if (b.lit) {
          b.inst.material = b.day;
          b.cells.forEach(([, , c], k) => b.inst.setColorAt(k, beadCol.set(c)));
          b.inst.instanceColor.needsUpdate = true;
          b.lit = false;
        }
        return;
      }
      if (!b.lit) {
        b.inst.material = b.night;
        b.lit = true;
      }
      const cx = 4 * p.c[0], zb = 4 * p.c[2] + (p.s || 0), x0 = 4 * lamp.p.c[0] - L.LAMP.half, z0 = 4 * lamp.p.c[2] + (lamp.p.s || 0) + L.LAMP.base;
      b.cells.forEach(([i, r, c], k) => {
        const lx = Math.floor((cx - L.PAL_N + 2 * i + 1 - x0) / 4), ly = LED - 1 - Math.floor((zb + 2 * (L.PAL_N - 1 - r) + 1 - z0) / 4);
        const j = (ly * LED + lx) * 3, behind = lx >= 0 && lx < LED && ly >= 0 && ly < LED;
        CORE.transmit(c, behind ? [lamp.buf[j], lamp.buf[j + 1], lamp.buf[j + 2]] : DARK, px);
        b.inst.setColorAt(k, beadCol.setRGB(px[0], px[1], px[2]));
      });
      b.inst.instanceColor.needsUpdate = true;
    });
  }
  const TH0 = -0.4;
  const cam = { th: TH0, ph: 1.12, r: 280, target: new THREE.Vector3(60, 42, 48) };
  function placeCamera() {
    camera.position.set(cam.target.x + cam.r * Math.sin(cam.ph) * Math.sin(cam.th), cam.target.y + cam.r * Math.cos(cam.ph), cam.target.z + cam.r * Math.sin(cam.ph) * Math.cos(cam.th));
    camera.lookAt(cam.target);
  }
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    cam.r = w / h < 1.1 ? 340 : 280;
    camera.updateProjectionMatrix();
    redraw();
  }
  new ResizeObserver(resize).observe(el);
  let drag = null, lastInput = -1;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph };
    renderer.domElement.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!drag) return;
    cam.th = drag.th - (e.clientX - drag.x) * 8e-3;
    cam.ph = Math.min(1.45, Math.max(0.45, drag.ph - (e.clientY - drag.y) * 6e-3));
    lastInput = performance.now();
    redraw();
  });
  const endDrag = () => {
    drag = null;
    el.classList.remove("is-dragging");
  };
  renderer.domElement.addEventListener("pointerup", endDrag);
  renderer.domElement.addEventListener("pointercancel", endDrag);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true, running = false, tPrev = null;
  const tmpM = new THREE.Matrix4(), tmpR = new THREE.Matrix4(), tmpT = new THREE.Matrix4();
  const DROP_MS = 550, DROP_MM = 40;
  function frame(now) {
    if (!visible) {
      running = false;
      return;
    }
    const t = now / 1e3, dt = tPrev === null ? 0 : now - tPrev;
    if (!drag && lastInput < 0 && !reduce) cam.th = TH0 + 0.32 * Math.sin(now * 18e-5);
    tPrev = now;
    placeCamera();
    spinAng = spinOn ? reduce ? 0.5 : spinAng + dt * 7e-4 : 0;
    const spin = new Map();
    for (const r of turning) {
      const d = L.describe(r.axle), a = { c: L2T([0, 1, 2].map((k) => (d.min[k] + d.max[k]) / 2)), axis: U[r.axle.A], ang: spinAng };
      for (const p of r.moving) spin.set(p, a);
    }
    meshes.forEach((m) => {
      const piv = spin.get(m.userData.part);
      if (piv) {
        tmpT.makeTranslation(piv.c.x, piv.c.y, piv.c.z);
        tmpR.makeRotationAxis(piv.axis, piv.ang);
        tmpM.makeTranslation(-piv.c.x, -piv.c.y, -piv.c.z);
        m.matrix.copy(tmpT).multiply(tmpR).multiply(tmpM).multiply(m.userData.base);
      } else m.matrix.copy(m.userData.base);
      const d0 = drops.get(m);
      if (d0 !== void 0) {
        const k = Math.min(1, (now - d0) / DROP_MS), lift = DROP_MM * (1 - k) * (1 - k);
        if (k >= 1) drops.delete(m);
        tmpT.makeTranslation(0, lift, 0);
        m.matrix.premultiply(tmpT);
      }
      m.updateMatrixWorld(true);
    });
    lightLamps(reduce ? 0 : t);
    renderer.render(scene, camera);
    if (reduce) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || !visible) return;
    running = true;
    tPrev = null;
    requestAnimationFrame(frame);
  }
  function redraw() {
    if (reduce) start();
  }
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) start();
  }, { rootMargin: "100px" }).observe(el);
  const userMeshes = [];
  const api = {
    show(i, instant) {
      const m = userMeshes[i];
      if (!m || m.visible) return;
      m.visible = true;
      if (!instant && !reduce) drops.set(m, performance.now());
      redraw();
    },
    light(on) {
      lampOn = !!on;
      redraw();
    },
    spin(on) {
      spinOn = !!on;
      redraw();
    },
    reset() {
      userMeshes.forEach((m) => {
        m.visible = false;
      });
      drops.clear();
      lampOn = false;
      spinOn = false;
      redraw();
    }
  };
  let ready;
  window.MBShowcase = { ready: new Promise((res, rej) => {
    ready = { res, rej };
  }) };
  const expand = (pattern) => pattern.rows.map((row) => [...row].map((ch) => ch === "." ? null : pattern.palette[Number(ch) - 1]));
  fetch(el.getAttribute("data-showcase")).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then((data) => {
    const baseboard = L.baseboardConfig(data.baseboard);
    mats.plate.color.set(baseboard.color);
    if (data.lamp) lampSettings = data.lamp;
    const add = (p) => {
      world.add(p);
      const mesh = buildMesh(p, p.type === "pal" || p.type === "lamp" ? null : baseMat(p), baseboard);
      mesh.userData.part = p;
      scene.add(mesh);
      meshes.set(p.id, mesh);
      return mesh;
    };
    L.boardParts(baseboard).forEach(add);
    for (const o of data.parts) {
      const p = { ...o };
      if (p.pattern) {
        delete p.pattern;
        p.cells = expand(data.pattern);
        p.color = data.pattern.palette[0];
      }
      userMeshes.push(add(p));
    }
    const info = L.analyze(world.parts);
    turning = world.parts.filter((p) => p.type === "pal").map((p) => L.rotationCheck(world.parts, p, info)).filter((r) => r.ok);
    lampOn = true;
    spinOn = true;
    el.classList.add("is-ready");
    resize();
    start();
    ready.res({ ...api, data });
  }).catch((e) => {
    fail();
    ready.rej(e);
  });
})();
