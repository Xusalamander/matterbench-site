// 第 4 关:立体搭建。先「跟着搭」:给拼豆伙伴搭一副骨架,每一步只学一个新动作,零件放在发光的位置,自动对齐;
// 最后一步让伙伴自己站上去:伙伴也是一个零件,脚下两颗竖着的拼豆插进肩膀的孔(见 lattice.js 的 pal)。
// 伙伴的样子和卡片一样由它学会的技能决定(MBCard.fxOf),换页、换标签过关都实时跟着变。搭完解锁「自由搭」。
// 格子、零件、连接判断在 lattice.js;这里是 3D 画面、跟着搭和编辑。
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const L = window.MBLattice, QMM = L.QMM;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const storage = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密窗口等 */ } },
  };
  const el = $("gl");
  if (typeof THREE === "undefined") { el.textContent = "3D 画面没能加载(需要联网),刷新试试。"; return; }

  // ---- 伙伴 ----
  let passed = MBQuest.levels();
  const fx = () => (window.MBCard ? MBCard.fxOf(passed) : {}); // 和卡片同一处:学会了哪些技能
  const myCard = storage.get("mb.card");
  const pet = window.MBCard && myCard && Number.isInteger(myCard.seed) ? MBCard.makeCard(myCard.seed) : null;
  const petName = pet ? pet.name : "你的伙伴";
  const PCELLS = pet ? pet.cells.map((row) => row.map(Boolean)) : null;
  const hydrate = (p) => (p.type === "pal" ? { mount: "feet", ...p, cells: PCELLS } : p); // 伙伴的形状不存档,按卡片现算
  const BEAD_COLORS = [...new Set([pet ? pet.body : "#E5484D", "#E5484D", "#F28B2E", "#F5D547", "#3DB86B", "#3E63DD", "#F6E7DA", "#16181D"])];

  // ---- 跟着搭:每一步只学一个动作,放在发光的位置 ----
  const legBead = (k) => ({ type: "bead", A: 2, c: [4, 6, k >> 1], s: k & 1, n: 1, color: BEAD_COLORS[0] });
  const GUIDE = [
    { id: "g1", tool: "bead", act: "点一下放(和第 1 关一样)", label: "放下第一颗拼豆", title: "放下第一颗拼豆",
      tip: "点底板上发光的位置。每颗拼豆是一段直径 5 mm、高 5 mm 的小圆管,最下面这颗正好卡进底板的孔里。",
      targets: [legBead(0)] },
    { id: "g2", tool: "bead", act: "拖动转视角(和第 2 关一样)", label: `把豆子叠成${petName}的一条腿`, title: "叠成一条腿",
      tip: "在同一个位置再点 3 下,豆子一颗颗叠上去,烫在一起就是一条腿。按住画面拖动,可以转过去从侧面看。",
      targets: [legBead(1), legBead(2), legBead(3)] },
    { id: "g3", tool: "rod", act: "换零件", label: "用圆棒立起另一条腿", title: "另一条腿:换圆棒",
      tip: "一颗颗叠太慢?圆棒就是一整根连起来的拼豆,一样粗。点「零件」里的「圆棒」,再点发光的位置,一下就立好。",
      targets: [{ type: "rod", A: 2, c: [8, 6, 0], n: 2 }] },
    { id: "g4", tool: "strip", act: "换零件", label: "搭上两层肩膀", title: "搭上两层肩膀",
      tip: "扁条每 10 mm 一个孔。换「扁条」,点两个发光的位置,上下各一层,两头的孔都套进两条腿。两层夹着,待会儿伙伴的脚插进去又深又稳。",
      targets: [{ type: "strip", A: 2, R: 0, c: [4, 6, 1], s: 1, n: 5 }, { type: "strip", A: 2, R: 0, c: [4, 6, 1], s: 3, n: 5 }] },
    { id: "g5", tool: "clip", act: "孔就是关节(和第 3 关一样)", label: "装一只能转的手臂", title: "装一只能转的手臂",
      tip: "卡扣只套着一条腿、别的都不碰,就能绕着腿转。换「卡扣」,点发光的位置,给伙伴装上手臂。",
      targets: [{ type: "clip", A: 2, R: 0, c: [8, 6, 0], s: 3, n: 1 }] },
    ...(pet ? [{ id: "g6", tool: "pal", act: "伙伴也是零件", label: `让${petName}站上肩膀`, title: `让${petName}站上去`,
      tip: `${petName}本身也是拼豆:卡片上的 14×14 颗直径 5 mm 的豆烫成一块 70×70 mm 的板。板底下有两只竖着的脚,每只是两颗豆叠起来(10 mm),相距 20 mm,穿过上下两层肩膀的孔。点「零件」里的「伙伴」,再点发光的位置。`,
      targets: [hydrate({ type: "pal", c: [6, 6, 2], s: 0 })] }] : []),
  ];
  // 过关后的进阶:做个转台。柱子上套一个卡扣,伙伴换成一只脚,插在卡扣另一个孔里,跟着卡扣绕柱子转
  const ADV = pet ? [
    { tool: "rod", title: "立一根柱子", act: "换零件", tip: "在空地上立一根 30 mm 的圆棒,当转台的轴。点「圆棒」,再点发光的位置。",
      target: { type: "rod", A: 2, c: [9, 2, 0], n: 3 } },
    { tool: "clip", title: "柱子上套一个卡扣", act: "卡扣当转台", tip: "卡扣一个孔套在柱子上,另一个孔空着,等会儿插伙伴的脚。点「卡扣」,再点发光的位置。",
      target: { type: "clip", A: 2, R: 0, c: [9, 2, 2], s: 2, n: 1 } },
    { tool: "pal", title: `${petName}换成一只脚`, act: "换站法", tip: `点「伙伴」,在「放置」里把站法换成「一只脚,能转」,再点发光的位置。${petName}会从肩膀上搬过来,脚插进卡扣的另一个孔。`,
      target: hydrate({ type: "pal", c: [10, 2, 3], s: 1, mount: "pivot" }) },
  ] : [];
  const quest = MBQuest.init({ level: "build", manual: true, tasks: GUIDE.map((g) => ({ id: g.id, label: g.label })) }); // 进度按零件算,卡片自己画
  const saved = storage.get("mb.demo.build") || {};
  let free = !!saved.free || !!passed.build; // 跟着搭做完(或以前过了关)才能自由搭
  let advDone = !!saved.advDone;

  // ---- 3D 场景 ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 0.62));
  const sun = new THREE.DirectionalLight(0xffffff, 0.42); sun.position.set(120, 260, 80); scene.add(sun);
  const U = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)];
  const L2T = (a) => new THREE.Vector3(a[0] * QMM, a[2] * QMM, a[1] * QMM);
  const grid = new THREE.GridHelper(130, 13, 0x888888, 0x888888);
  grid.material.transparent = true; grid.material.opacity = 0.3; scene.add(grid);

  const mats = {}, beadMats = new Map();
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: new THREE.Color(c), side: THREE.DoubleSide });
  function applyTheme() {
    scene.background = new THREE.Color(css("--view"));
    for (const k of ["rod", "strip", "clip", "plate", "bad", "ok", "sel", "warn"]) {
      if (!mats[k]) mats[k] = lambert(css("--" + k)); else mats[k].color.set(css("--" + k));
    }
    if (!mats.ghostOk) {
      mats.ghostOk = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      mats.ghostBad = mats.ghostOk.clone();
      mats.target = mats.ghostOk.clone(); // 跟着搭:发光的目标位置
    }
    mats.ghostOk.color.set(css("--ok")); mats.ghostBad.color.set(css("--bad")); mats.target.color.set(css("--sel"));
    grid.material.color.set(css("--text-2"));
    paintParts();
  }
  const beadMat = (c) => { if (!beadMats.has(c)) beadMats.set(c, lambert(c)); return beadMats.get(c); };
  const baseMat = (p) => (p.base ? mats.plate : p.type === "bead" ? beadMat(p.color || BEAD_COLORS[0]) : mats[p.type]);

  function buildMesh(p, mat) {
    if (p.type === "pal") return buildPalMesh(p, mat);
    const d = L.describe(p), A = p.A, m = new THREE.Matrix4();
    let geo, origin, xv, yv, zv;
    if (p.type === "rod") {
      geo = new THREE.CylinderGeometry(2.5, 2.5, p.n * 10, 20); geo.rotateX(Math.PI / 2);
      origin = L2T([0, 1, 2].map((t) => (d.min[t] + d.max[t]) / 2));
      zv = U[A]; xv = U[(A + 1) % 3]; yv = U[(A + 2) % 3];
    } else if (p.type === "bead") { // 小圆管:外径 5 mm,中间一个孔
      const sh = new THREE.Shape(); sh.absarc(0, 0, 2.45, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, 1.1, 0, Math.PI * 2, true); sh.holes.push(hole);
      geo = new THREE.ExtrudeGeometry(sh, { depth: p.n * 5, bevelEnabled: false, curveSegments: 18 });
      origin = L2T([0, 1, 2].map((t) => (t === A ? d.min[t] : (d.min[t] + d.max[t]) / 2)));
      zv = U[A]; xv = U[(A + 1) % 3]; yv = U[(A + 2) % 3];
      if (new THREE.Vector3().crossVectors(xv, yv).dot(zv) < 0) yv = yv.clone().negate(); // 保持右手坐标
    } else {
      const R = p.R, W = 3 - A - R, shape = new THREE.Shape(), o = [0, 0, 0];
      if (p.type === "strip") {
        const len = p.n * 10;
        shape.moveTo(0, -5); shape.lineTo(len, -5); shape.lineTo(len, 5); shape.lineTo(0, 5); shape.lineTo(0, -5);
        for (let k = 0; k < p.n; k++) { const hp = new THREE.Path(); hp.absarc(5 + 10 * k, 0, 2.6, 0, Math.PI * 2, true); shape.holes.push(hp); }
        o[R] = d.min[R]; o[W] = d.s0[W]; o[A] = d.min[A];
        geo = new THREE.ExtrudeGeometry(shape, { depth: QMM, bevelEnabled: false, curveSegments: 10 });
      } else {
        shape.moveTo(0, -4); shape.lineTo(10, -4); shape.absarc(10, 0, 4, -Math.PI / 2, Math.PI / 2, false);
        shape.lineTo(0, 4); shape.absarc(0, 0, 4, Math.PI / 2, Math.PI * 1.5, false);
        for (let k = 0; k < 2; k++) { const hp = new THREE.Path(); hp.absarc(10 * k, 0, 2.4, 0, Math.PI * 2, true); shape.holes.push(hp); }
        o[R] = d.s0[R]; o[W] = d.s0[W]; o[A] = d.min[A];
        geo = new THREE.ExtrudeGeometry(shape, { depth: p.n * QMM, bevelEnabled: false, curveSegments: 12 });
      }
      origin = L2T(o); xv = U[R]; yv = U[W]; zv = U[A];
    }
    m.makeBasis(xv, yv, zv); m.setPosition(origin);
    const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false; mesh.matrix.copy(m); mesh.updateMatrixWorld(true);
    mesh.userData.base = m.clone();
    return mesh;
  }

  // ---- 零件、撤销 ----
  const world = new L.World(), meshes = new Map();
  let undoStack = [], redoStack = [], sel = new Set(), hover = null;
  let info = L.analyze([]);
  const steps = { on: false, k: 1 };
  function addPart(p) {
    world.add(p);
    const mesh = buildMesh(p, p.type === "pal" ? null : baseMat(p)); mesh.userData.part = p; scene.add(mesh); meshes.set(p.id, mesh);
  }
  const dispose = (o) => o.traverse((c) => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); });
  const setMat = (o, mat) => { if (o.isMesh) o.material = mat; else o.traverse((c) => { if (c.isMesh) c.material = mat; }); };
  function removePart(p) {
    const mesh = meshes.get(p.id); scene.remove(mesh); dispose(mesh); meshes.delete(p.id);
    world.remove(p); sel.delete(p); if (hover === p) hover = null;
  }
  const userParts = () => world.parts.filter((p) => !p.base);
  const plain = (p) => {
    const o = { type: p.type, A: p.A, c: p.c.slice(), n: p.n };
    if (p.type === "pal") return { type: "pal", c: p.c.slice(), s: p.s || 0, mount: p.mount || "feet" };
    if (p.type === "bead") { o.s = p.s || 0; o.color = p.color || BEAD_COLORS[0]; }
    else if (p.type !== "rod") { o.R = p.R; o.s = p.s; }
    return o;
  };
  const clone = (p, d = [0, 0, 0]) => hydrate({ ...plain(p), c: [p.c[0] + d[0], p.c[1] + d[1], p.c[2] + d[2]] });
  const inBounds = (p) => p.c[0] >= -2 && p.c[0] <= 14 && p.c[1] >= -2 && p.c[1] <= 14 && p.c[2] >= 0 && p.c[2] <= 14;
  // 同一个零件(不管颜色):用来认「发光的位置放好了没有」
  const sig = (p) => JSON.stringify([p.type, p.A, p.R ?? null, p.c, p.s || 0, p.n, p.mount ?? null]);
  const placedSigs = () => new Set(userParts().map(sig));
  function commit(ops) { if (!ops.length) return; undoStack.push(ops); if (undoStack.length > 200) undoStack.shift(); redoStack = []; }
  function applyOps(ops, reverse) {
    for (const o of reverse ? ops.slice().reverse() : ops) {
      const add = (o.op === "add") !== reverse;
      if (add) { if (world.canPlace(o.part)) addPart(o.part); } else if (world.parts.includes(o.part)) removePart(o.part);
    }
  }
  function undo() { const ops = undoStack.pop(); if (!ops) return; applyOps(ops, true); redoStack.push(ops); refresh(); }
  function redo() { const ops = redoStack.pop(); if (!ops) return; applyOps(ops, false); undoStack.push(ops); refresh(); }
  function replace(olds, news) { // 要么全成,要么都不动
    olds.forEach(removePart);
    const added = [];
    for (const p of news) { if (!inBounds(p) || !world.canPlace(p)) break; addPart(p); added.push(p); }
    if (added.length < news.length) { added.forEach(removePart); olds.forEach(addPart); return false; }
    commit([...olds.map((p) => ({ op: "del", part: p })), ...news.map((p) => ({ op: "add", part: p }))]);
    return true;
  }
  const valid = (o) => (o && o.type === "pal" ? !!PCELLS && Array.isArray(o.c) && o.c.length === 3 && o.c.every(Number.isInteger) && [0, 1, 2, 3].includes(o.s || 0) && [undefined, "feet", "pivot"].includes(o.mount) : validPart(o));
  const validPart = (o) => o && ["bead", "rod", "strip", "clip"].includes(o.type) && Array.isArray(o.c) && o.c.length === 3 && o.c.every(Number.isInteger)
    && [0, 1, 2].includes(o.A) && Number.isInteger(o.n) && o.n >= LIM[o.type][0] && o.n <= LIM[o.type][1]
    && (o.type !== "bead" || (/^#[0-9A-Fa-f]{6}$/.test(o.color || "") && [0, 1].includes(o.s || 0)))
    && (o.type === "rod" || o.type === "bead" || ([0, 1, 2].includes(o.R) && o.R !== o.A && Number.isInteger(o.s) && o.s >= 0 && o.s <= 3));
  const save = () => storage.set("mb.demo.build", { free, advDone, parts: userParts().map(plain) });

  // ---- 跟着搭的进度:按世界里已经放好的零件算,撤销也跟着退 ----
  function guideAt() {
    const have = placedSigs();
    const i = GUIDE.findIndex((g) => g.targets.some((t) => !have.has(sig(t))));
    return i < 0 ? GUIDE.length : i;
  }
  const nextTarget = (g) => { const have = placedSigs(); return g.targets.find((t) => !have.has(sig(t))); };
  let doneMax = 0; // 打过勾的步数(任务清单的勾只加不减)
  // 进阶转台到第几步(-1:没开始或已经做完)
  const advAt = () => { if (!free || advDone || !ADV.length) return -1; const have = placedSigs(); const i = ADV.findIndex((a) => !have.has(sig(a.target))); return i; };
  const advTarget = (tool) => { const i = advAt(); return i >= 0 && ADV[i].tool === tool ? ADV[i].target : null; };
  const unlocked = (tool) => free || tool === "bead" || GUIDE.findIndex((g) => g.tool === tool) <= guideAt();

  // ---- 放置参数(自由搭用) ----
  const ORI = {
    bead: [{ A: 2 }, { A: 0 }, { A: 1 }],
    rod: [{ A: 2 }, { A: 0 }, { A: 1 }],
    strip: [{ A: 2, R: 0 }, { A: 2, R: 1 }, { A: 0, R: 2 }, { A: 0, R: 1 }, { A: 1, R: 2 }, { A: 1, R: 0 }],
    clip: [{ A: 2, R: 0 }, { A: 2, R: 1 }, { A: 0, R: 1 }, { A: 0, R: 2 }, { A: 1, R: 0 }, { A: 1, R: 2 }],
    pal: [{ mount: "feet" }, { mount: "pivot" }], // 站法:两只脚 / 一只脚(插在卡扣上能转)
  };
  const LIM = { bead: [1, 1], rod: [1, 16], strip: [2, 12], clip: [1, 4] };
  const NAMES = { bead: "拼豆", rod: "圆棒", strip: "扁条", clip: "卡扣", pal: "伙伴" };
  const AX = ["左右", "前后", "竖直"];
  const st = { tool: "bead", ori: { bead: 0, rod: 0, strip: 0, clip: 0, pal: 0 }, n: { bead: 1, rod: 4, strip: 4, clip: 2, pal: 1 }, h: 0, s: 0, color: BEAD_COLORS[0], cell: [5, 5], over: false };
  const isPartTool = (t) => t in ORI;
  const partName = (p) => (p.type === "pal" ? petName : p.type === "bead" ? "拼豆" : NAMES[p.type] + " " + (p.type === "rod" ? p.n * 10 + " mm" : p.type === "strip" ? p.n + " 孔" : p.n * QMM + " mm"));

  function dropBead(p) { // 拼豆往下落,碰到东西(或卡进底板的孔)就停
    if (p.A === 2) {
      for (let k = 28; k >= 0; k--) {
        const q = { ...p, c: [p.c[0], p.c[1], k >> 1], s: k & 1 };
        if (!world.canPlace(q)) return k < 28 ? { ...p, c: [p.c[0], p.c[1], (k + 1) >> 1], s: (k + 1) & 1 } : null;
        if (k === 0) return q;
      }
    }
    for (let h = 14; h >= 0; h--) {
      const q = { ...p, c: [p.c[0], p.c[1], h] };
      if (!world.canPlace(q)) return h < 14 ? { ...p, c: [p.c[0], p.c[1], h + 1] } : null;
      if (h === 0) return q;
    }
    return null;
  }
  function dropPal(p) { // 伙伴也往下落:脚碰到底板或零件就停(脚在板底下 10 mm,所以板底最低 10 mm)
    for (let k = 56; k >= L.FOOT_Q; k--) {
      const q = hydrate({ ...p, c: [p.c[0], p.c[1], k >> 2], s: k & 3 });
      if (!world.canPlace(q)) return k < 56 ? hydrate({ ...p, c: [p.c[0], p.c[1], (k + 1) >> 2], s: (k + 1) & 3 }) : null;
      if (k === L.FOOT_Q) return q;
    }
    return null;
  }
  // 跟着搭:指在目标附近(它占的格子外扩一格)就吸过去
  function nearTarget(t) {
    const d = L.describe(t), lo = (v) => Math.floor(v / 4) - 1, hi = (v) => Math.ceil(v / 4);
    return st.cell[0] >= lo(d.min[0]) && st.cell[0] <= hi(d.max[0]) && st.cell[1] >= lo(d.min[1]) && st.cell[1] <= hi(d.max[1]);
  }
  function current() {
    if (!isPartTool(st.tool) || steps.on || !unlocked(st.tool)) return null;
    if (!free) {
      const g = GUIDE[guideAt()];
      if (!g || g.tool !== st.tool) return null;
      const t = nextTarget(g);
      return t && nearTarget(t) ? hydrate({ ...t, c: t.c.slice() }) : null;
    }
    if (st.tool === "pal") {
      if (!PCELLS) return null;
      const t = advTarget("pal"); // 进阶「转台」:站法对了就吸到发光的位置
      if (t && ORI.pal[st.ori.pal].mount === "pivot" && nearTarget(t)) return hydrate({ ...t, c: t.c.slice() });
      return dropPal({ type: "pal", c: [st.cell[0], st.cell[1], 0], s: 0, mount: ORI.pal[st.ori.pal].mount });
    }
    const adv = advTarget(st.tool);
    if (adv && nearTarget(adv)) return { ...adv, c: adv.c.slice() };
    const o = ORI[st.tool][st.ori[st.tool]];
    const p = { type: st.tool, A: o.A, c: [st.cell[0], st.cell[1], st.h], n: st.n[st.tool] };
    if (st.tool === "bead") { p.s = 0; p.color = st.color; return dropBead(p); }
    if (st.tool !== "rod") { p.R = o.R; p.s = st.s; }
    return p;
  }

  // ---- 发光的目标位置 ----
  let targetMeshes = [];
  function showTargets() {
    targetMeshes.forEach((m) => { scene.remove(m); dispose(m); });
    targetMeshes = [];
    if (steps.on) return;
    const have = placedSigs(), a = advAt();
    const list = !free ? (GUIDE[guideAt()] || { targets: [] }).targets : a >= 0 ? [ADV[a].target] : [];
    for (const t of list) if (!have.has(sig(t))) { const m = buildMesh(t, mats.target); scene.add(m); targetMeshes.push(m); }
  }

  // ---- 伙伴的样子:和卡片同一套技能 ----
  // 没学会「拼出身体」:半透明的图纸;「发光」:豆子自己亮、身前一团光;「可动」:两侧各一根 3 颗的豆条手臂在挥
  const tubeGeos = {};
  const tubeGeo = (axis) => { // 拼豆小圆管,沿 three 的 z(axis "z")或 y(axis "y");两种各做一次,大家共用
    if (tubeGeos[axis]) return tubeGeos[axis];
    const sh = new THREE.Shape(); sh.absarc(0, 0, 2.45, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, 1.1, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false, curveSegments: 14 });
    g.translate(0, 0, -2.5); if (axis === "y") g.rotateX(-Math.PI / 2);
    g.userData.shared = true;
    return (tubeGeos[axis] = g);
  };
  function buildPalMesh(p, mat) {
    const look = fx(), N = L.PAL_N, group = new THREE.Group();
    const cx = 4 * p.c[0], cy = 4 * p.c[1], zb = 4 * p.c[2] + (p.s || 0);
    const cells = [];
    pet.cells.forEach((row, r) => row.forEach((c, i) => { if (c) cells.push([i, r, c]); }));
    let m2 = mat;
    if (!m2) m2 = look.body
      ? (look.light ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: 0xffffff }))
      : new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
    const inst = new THREE.InstancedMesh(tubeGeo("z"), m2, cells.length), mm = new THREE.Matrix4(), col = new THREE.Color();
    cells.forEach(([i, r, c], k) => {
      mm.makeTranslation((cx - N + 2 * i + 1) * QMM, (zb + 2 * (N - 1 - r) + 1) * QMM, cy * QMM);
      inst.setMatrixAt(k, mm); if (!mat) inst.setColorAt(k, col.set(c));
    });
    group.add(inst);
    // 脚:每只两颗豆叠起来,竖着插进下面的孔
    for (const f of L.palFeet(p)) for (let k = 0; k < L.FOOT_Q / 2; k++) {
      const foot = new THREE.Mesh(tubeGeo("y"), mat || beadMat(pet.body));
      foot.position.set((cx + 4 * f) * QMM, (zb - 1 - 2 * k) * QMM, cy * QMM); group.add(foot);
    }
    group.userData.arms = [];
    if (!mat && look.move) { // 手臂:销子穿过身体边上那颗豆,和卡片、第 3 关一样
      const row = pet.cells[7], xl = row.findIndex((v) => v && v !== "#16181D"), z7 = (zb + 2 * (N - 1 - 7) + 1) * QMM;
      for (const side of [-1, 1]) {
        const i = side < 0 ? xl : N - 1 - xl, arm = new THREE.Group();
        arm.position.set((cx - N + 2 * i + 1) * QMM, z7, (cy + 2) * QMM);
        for (let j = 1; j <= 3; j++) { const b = new THREE.Mesh(tubeGeo("z"), beadMat(pet.accent)); b.position.set(side * j * 5, 0, 0); arm.add(b); }
        arm.userData.side = side; group.add(arm); group.userData.arms.push(arm);
      }
    }
    if (!mat && look.light && look.body) {
      const pl = new THREE.PointLight(new THREE.Color(pet.body), 1.2, 110);
      pl.position.set(cx * QMM, (zb + N) * QMM, (cy + 10) * QMM); group.add(pl); group.userData.glow = pl;
    }
    group.matrixAutoUpdate = false; group.userData.base = new THREE.Matrix4();
    return group;
  }
  // 技能变了(这一页过关、或别的标签页过了关):重画伙伴、刷新技能条
  function applySkills() {
    passed = MBQuest.levels();
    for (const p of userParts()) if (p.type === "pal") {
      const old = meshes.get(p.id); scene.remove(old); dispose(old);
      const mesh = buildMesh(p, null); mesh.userData.part = p; scene.add(mesh); meshes.set(p.id, mesh);
    }
    renderStage();
  }
  const palPart = () => userParts().find((p) => p.type === "pal");
  const palStanding = () => { const p = palPart(); return !!p && info.grounded.has(p); };

  // ---- 颜色:选中、悬空、装配步骤 ----
  function matFor(p) {
    if (steps.on) return info.order.indexOf(p) === steps.k - 1 ? mats.sel : baseMat(p);
    if (st.tool === "del" && hover === p) return mats.bad;
    if (sel.has(p)) return mats.sel;
    if (free && info.floating.includes(p)) return mats.warn;
    return baseMat(p);
  }
  function paintParts() {
    if (!mats.rod) return;
    meshes.forEach((m) => {
      const p = m.userData.part, i = info.order.indexOf(p);
      if (m.isMesh) m.material = matFor(p);
      m.visible = !steps.on || p.base || (i >= 0 && i < steps.k); // 播放步骤时只显示装到这一步的零件
    });
  }

  let ghost = null, ghostKey = "";
  function planeY() {
    if (!free || !isPartTool(st.tool) || st.tool === "bead" || st.tool === "pal") return 0;
    const o = ORI[st.tool][st.ori[st.tool]];
    return (4 * st.h + (st.tool !== "rod" && o.A === 2 ? st.s : 0)) * QMM;
  }
  function updateGhost() {
    const p = st.over ? current() : null, key = p ? JSON.stringify(p) : "";
    if (key !== ghostKey) {
      if (ghost) { scene.remove(ghost); dispose(ghost); ghost = null; }
      ghostKey = key;
      if (p) { ghost = buildMesh(p, world.canPlace(p) ? mats.ghostOk : mats.ghostBad); scene.add(ghost); }
    }
    const pos = $("pos"), fit = $("fit"), g = !free && GUIDE[guideAt()];
    if (steps.on) { pos.textContent = `装配步骤 ${steps.k} / ${info.order.length}`; fit.textContent = "只看不改"; fit.className = "chip sel"; }
    else if (g && g.tool !== st.tool) { pos.textContent = `先在「零件」里点「${NAMES[g.tool]}」`; fit.textContent = "换零件"; fit.className = "chip sel"; }
    else if (g && !p) { pos.textContent = "指到发光的位置"; fit.textContent = "—"; fit.className = "chip"; }
    else if (st.tool === "sel") { pos.textContent = hover ? partName(hover) : "指向一个零件"; fit.textContent = "已选 " + sel.size; fit.className = "chip sel"; }
    else if (st.tool === "del") { pos.textContent = hover ? "点一下删掉它" : "指向一个零件"; fit.textContent = "删除"; fit.className = "chip bad"; }
    else if (p) {
      const d = L.describe(p), ok = world.canPlace(p);
      pos.textContent = `高 ${d.min[2] * QMM}–${d.max[2] * QMM} mm`;
      fit.textContent = ok ? "点一下放" : "会撞到"; fit.className = "chip " + (ok ? "ok" : "bad");
      if (ghost) setMat(ghost, ok ? mats.ghostOk : mats.ghostBad);
    } else { pos.textContent = st.over && st.tool === "bead" ? "这里叠满了" : "指向底板"; fit.textContent = "—"; fit.className = "chip"; }
    grid.position.set(55, planeY() + 0.05, 55);
    paintParts();
  }

  // ---- 刷新 ----
  let flash = null;
  function say(msg) { flash = msg; renderSel(); clearTimeout(say.t); say.t = setTimeout(() => { flash = null; renderSel(); }, 2600); }
  function refresh() {
    info = L.analyze(world.parts);
    sel.forEach((p) => { if (!world.parts.includes(p)) sel.delete(p); });
    progress();
    const t = st.tool, isPart = isPartTool(t), g = !free && GUIDE[guideAt()];
    document.querySelectorAll("[data-free]").forEach((e) => { e.hidden = !free; });
    document.querySelectorAll("#tools button").forEach((b) => {
      const ok = unlocked(b.dataset.tool);
      b.disabled = !ok; b.setAttribute("aria-pressed", String(b.dataset.tool === t));
      b.classList.toggle("is-next", !!g && b.dataset.tool === g.tool && b.dataset.tool !== t);
      b.title = ok ? "" : "跟着搭到这一步就解锁";
    });
    $("toolNote").textContent = free ? "" : "跟着搭的时候,零件会自动对齐到发光的位置,不用调参数。";
    $("params").hidden = !free || !isPart; $("selSec").hidden = !free || t !== "sel";
    document.querySelectorAll('#tools [data-tool="pal"]').forEach((b) => { b.hidden = !pet; });
    if (free && t === "pal") {
      $("beadColors").hidden = true; $("row-n").hidden = true; $("row-h").hidden = true; $("row-s").hidden = true;
      $("rot").textContent = ORI.pal[st.ori.pal].mount === "pivot" ? "站法:一只脚,能转" : "站法:两只脚";
      $("rule").textContent = ORI.pal[st.ori.pal].mount === "pivot"
        ? "正中一只脚(两颗豆,10 mm),插在卡扣的另一个孔里,卡扣绕柱子转,伙伴就跟着转。"
        : "两只脚相距 20 mm,穿过一根扁条上隔一个孔的两个孔;上下两层扁条最稳。";
    } else if (free && isPart) {
      const o = ORI[t][st.ori[t]], n = st.n[t];
      $("beadColors").hidden = t !== "bead";
      $("rot").textContent = t === "bead" || t === "rod" ? AX[o.A] : `平面朝${AX[o.A]} · 沿${AX[o.R]}`;
      $("row-n").hidden = t === "bead";
      $("o-n").textContent = t === "rod" ? n * 10 + " mm" : t === "strip" ? `${n} 孔 · ${n * 10} mm` : n * QMM + " mm 厚";
      $("row-h").hidden = t === "bead";
      $("o-h").textContent = st.h * 10 + " mm";
      $("row-s").hidden = t === "bead" || t === "rod";
      $("o-s").textContent = "+" + st.s * QMM + " mm";
      $("rule").textContent = t === "bead" ? "点哪里,豆子就落到哪里,碰到东西就停。" : t === "rod" ? "圆棒立在底板的孔里;横着放时会架在高度那一层。" : "扁条、卡扣的孔要对准圆棒才套得上;「微调」上下挪 2.5 mm 找对位置。";
    }
    $("undo").disabled = !undoStack.length; $("redo").disabled = !redoStack.length;
    showTargets();
    renderSel(); renderCheck(); renderSteps(); renderStage(); renderBom(); save();
    ghostKey = "?"; updateGhost();
  }
  // 跟着搭每完成一步打勾;全部搭完就过关、解锁自由搭
  function progress() {
    if (free) {
      if (!advDone && ADV.length && advAt() < 0 && info.turntables.length) { advDone = true; toastNew(`转台做好了!${petName}能跟着卡扣绕柱子转身了`); }
      return;
    }
    const at = guideAt();
    while (doneMax < at) { quest.done(GUIDE[doneMax].id); doneMax++; }
    if (at >= GUIDE.length && !free) { free = true; applySkills(); cam.r = 300; cam.target.set(60, 34, 60); placeCamera(); toastNew(pet ? `${petName}站上了你搭的骨架,学会了「搭骨架」!自由搭解锁了` : "骨架搭好了!自由搭解锁了"); }
  }
  function renderBeadColors() {
    const box = $("beadColors"); box.innerHTML = "";
    BEAD_COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "swatch"; b.style.background = c; b.setAttribute("aria-label", "拼豆颜色 " + c);
      b.setAttribute("aria-pressed", String(c === st.color));
      b.addEventListener("click", () => { st.color = c; renderBeadColors(); ghostKey = "?"; updateGhost(); });
      box.appendChild(b);
    });
  }
  // 卡扣的四种用法,结构检查和选中时都这么说
  function roleText(p, r) {
    const name = `「${partName(p)}」`;
    if (r.role === "hinge") return `${name}是关节:只套着一根棒、别的都不碰,能绕它转`;
    if (r.role === "turntable") return `${name}是转台:套在柱子上,带着「${r.carried.map(partName).join("、")}」一起转`;
    if (r.role === "link") return `${name}把两根棒连在一起,间距固定在 10 mm`;
    return `${name}贴着别的零件套在棒上,是限位圈,卡住高度`;
  }
  function renderSel() {
    if (st.tool !== "sel") return;
    const n = sel.size, one = n === 1 ? [...sel][0] : null, role = one && info.roles.get(one);
    $("selInfo").textContent = flash || (n ? (role ? roleText(one, role) + "。" : `已选 ${n} 个` + (one ? ":" + partName(one) : "零件") + "。") + "方向键也能移动。" : "点一个零件选中它,按住 Shift 多选。");
    $("selTools").querySelectorAll("button").forEach((b) => { b.disabled = !n; });
  }
  function renderCheck() {
    if (!free) return;
    const ups = userParts();
    $("nParts").textContent = ups.length; $("nPins").textContent = info.pins; $("nTouch").textContent = info.touches; $("nFloat").textContent = info.floating.length;
    const items = [
      ...info.floating.map((p) => ["warn", `「${partName(p)}」没连到任何东西,会掉下来`, p]),
      ...info.touchOnly.map((p) => ["info", `「${partName(p)}」只是靠着,没有穿孔,要胶或压紧`, p]),
      ...info.pivots.filter((p) => p.type !== "clip").map((p) => ["ok", `「${partName(p)}」只套着一根圆棒,能绕它转`, p]),
      ...[...info.roles].map(([p, r]) => ["ok", roleText(p, r), p]),
    ];
    const ul = $("issues"); ul.innerHTML = "";
    if (!items.length) { const li = document.createElement("li"); li.textContent = ups.length ? "每个零件都连到了底板上。" : "还没有零件。"; ul.appendChild(li); return; }
    for (const [kind, text, p] of items.slice(0, 5)) {
      const li = document.createElement("li"); li.className = kind;
      const s = document.createElement("span"); s.textContent = text;
      const b = document.createElement("button"); b.type = "button"; b.textContent = "选中";
      b.addEventListener("click", () => { stopSteps(); st.tool = "sel"; sel = new Set([p]); refresh(); });
      li.append(s, b); ul.appendChild(li);
    }
    if (items.length > 5) { const li = document.createElement("li"); li.className = "info"; li.textContent = `还有 ${items.length - 5} 条`; ul.appendChild(li); }
  }
  function renderSteps() {
    $("stepOff").hidden = steps.on; $("stepOn").hidden = !steps.on;
    $("stepGo").disabled = !info.order.length;
    if (!steps.on) return;
    const N = info.order.length;
    if (!N) { steps.on = false; renderSteps(); return; }
    steps.k = Math.max(1, Math.min(N, steps.k));
    const r = $("stepRange"); r.max = N; r.value = steps.k;
    const p = info.order[steps.k - 1], pinTo = [], touchTo = [];
    let base = false;
    info.adj.get(p).forEach((kind, q) => {
      if (q.base) { base = true; return; }
      const i = info.order.indexOf(q); if (i < 0 || i >= steps.k - 1) return;
      (kind === "pin" ? pinTo : touchTo).push(i + 1);
    });
    const tube = L.isTube(p), pal = p.type === "pal", how = [];
    if (base) how.push(tube || pal ? "插进底板的孔" : "放在底板上");
    if (pinTo.length) how.push(pal ? (p.mount === "pivot" ? "一只脚插进第 " : "两只脚插进第 ") + pinTo.join("、") + " 步的孔" : (tube ? "穿过第 " : "套在第 ") + pinTo.join("、") + " 步的" + (tube ? "孔" : "圆棒上"));
    if (touchTo.length) how.push((p.type === "bead" ? "叠在第 " : "贴着第 ") + touchTo.join("、") + " 步" + (p.type === "bead" ? "上" : ""));
    $("stepTxt").textContent = `第 ${steps.k} / ${N} 步:装「${partName(p)}」,高 ${L.describe(p).min[2] * QMM} mm` + (how.length ? "," + how.join(",") : "") + "。"
      + (steps.k === N && info.floating.length ? ` 另有 ${info.floating.length} 个零件没连上,没算进步骤。` : "");
    $("stepPrev").disabled = steps.k <= 1; $("stepNext").disabled = steps.k >= N;
  }
  // 搭完以后:伙伴已经会的技能在骨架上用起来;还没学会的,告诉他去哪一关
  function skillLine() {
    const has = [], todo = [];
    const f = fx();
    if (!f.body) todo.push("过了第 1 关,它才会从图纸变成实心的豆");
    if (f.light) has.push("身上会发光"); else todo.push("过了第 2 关,它会发光");
    if (f.move) has.push("两只豆条手臂会挥、卡扣手臂会转"); else todo.push("过了第 3 关,它的手臂会挥起来");
    return (has.length ? `它学过的技能用上了:${has.join("、")}。` : "") + (todo.length ? todo.join(";") + "。" : "");
  }
  let flashMsg = "";
  function renderStage() {
    const at = guideAt(), g = GUIDE[at];
    if (!free && g) {
      const left = g.targets.filter((t) => !placedSigs().has(sig(t))).length;
      quest.card({ no: `第 4 关 · 第 ${at + 1} 步 / ${GUIDE.length}`, title: g.title, tip: g.tip, act: g.act, prog: g.targets.length > 1 ? `还差 ${left} ${g.tool === "bead" ? "颗" : "根"}` : "", flash: flashMsg });
    } else if (advAt() >= 0) {
      const a = advAt(), step = ADV[a];
      const wrongStance = step.tool === "pal" && st.tool === "pal" && ORI.pal[st.ori.pal].mount !== "pivot";
      quest.card({ no: `第 4 关 · 进阶 · 做个转台 ${a + 1} / ${ADV.length}`, title: step.title, tip: step.tip, act: step.act, prog: wrongStance ? "先把站法换成「一只脚,能转」" : "", flash: flashMsg });
    } else {
      const built = palStanding(), tt = info.turntables.length;
      quest.card({
        no: "第 4 关 · 自由搭", title: built ? `${petName}站上了你搭的骨架` : "所有零件都解锁了", flash: flashMsg,
        tip: (tt ? `卡扣转台:${petName}跟着卡扣绕柱子转${fx().move ? "。" : ";过了第 3 关它会自己转起来。"} ` : "") + (built ? skillLine() : pet ? "「伙伴」也能自己放:脚下两颗豆插进一根扁条上隔一个孔的两个孔。" : "领养一只拼豆伙伴,它也能站到骨架上。") + " 现在可以自己调长度、高度和方向,用「选择」移动、复制;「结构检查」会告诉你哪里会掉、哪里能转。",
      });
    }
    $("statusInfo").textContent = free && info.floating.length ? `⚠ ${info.floating.length} 个零件悬空` : `${userParts().length} 个零件 · ${info.pins} 处穿孔 · ${info.touches} 处贴合`;
  }
  function toastNew(msg) {
    flashMsg = msg; renderStage();
    clearTimeout(toastNew.t); toastNew.t = setTimeout(() => { flashMsg = ""; renderStage(); }, 6000);
  }
  function renderBom() {
    const groups = {};
    for (const p of userParts()) { const k = p.type + "|" + (p.type === "pal" ? L.palBeads(p) : L.cutLength(p)); groups[k] = (groups[k] || 0) + 1; }
    const order = ["pal", "bead", "rod", "strip", "clip"];
    const rows = Object.keys(groups).sort((a, b) => { const x = a.split("|"), y = b.split("|"); return order.indexOf(x[0]) - order.indexOf(y[0]) || x[1] - y[1]; })
      .map((k) => { const [t, len] = k.split("|"); return `<tr><td><span class="bdot bdot-${t}"></span>${t === "pal" ? petName + "(拼豆板)" : NAMES[t]}</td><td class="num">${t === "pal" ? len + " 颗豆" : len + " mm"}</td><td class="num">${groups[k]}</td></tr>`; });
    $("bom").innerHTML = rows.length ? rows.join("") : '<tr><td colspan="3" class="muted">还没有零件</td></tr>';
  }
  function startSteps() { if (!info.order.length) return; steps.on = true; steps.k = 1; sel.clear(); refresh(); }
  function stopSteps() { steps.on = false; }
  function setStep(k) { steps.k = k; renderSteps(); renderStage(); updateGhost(); }

  // ---- 编辑选中的零件(自由搭) ----
  const selList = () => world.parts.filter((p) => sel.has(p));
  function moveSel(d) {
    const olds = selList(); if (!olds.length) return;
    const news = olds.map((p) => clone(p, d));
    if (replace(olds, news)) { sel = new Set(news); refresh(); } else { sel = new Set(olds); refresh(); say("移不过去:会撞到别的零件或出界。"); }
  }
  function copySel() { // 找最近的空位:沿左右、前后、往上依次试 1–6 格
    const olds = selList(); if (!olds.length) return;
    for (let g = 1; g <= 6; g++) for (let ax = 0; ax < 3; ax++) {
      const d = [0, 0, 0]; d[ax] = g;
      const news = olds.map((p) => clone(p, d));
      if (news.every(inBounds) && replace([], news)) { sel = new Set(news); refresh(); say(`复制好了,挪了 ${g} 格。`); return; }
    }
    say("附近没有空位放复制品。");
  }
  function delSel() { const olds = selList(); if (!olds.length) return; olds.forEach(removePart); commit(olds.map((p) => ({ op: "del", part: p }))); refresh(); }
  function groupSel() {
    const seen = new Set(), todo = selList();
    while (todo.length) { const p = todo.pop(); if (seen.has(p)) continue; seen.add(p); info.adj.get(p).forEach((k, q) => { if (!q.base && !seen.has(q)) todo.push(q); }); }
    sel = seen; refresh();
  }

  // ---- 视角、动画 ----
  const cam = { th: -0.75, ph: 1.0, r: 230, target: new THREE.Vector3(60, 14, 60) };
  function placeCamera() {
    camera.position.set(cam.target.x + cam.r * Math.sin(cam.ph) * Math.sin(cam.th), cam.target.y + cam.r * Math.cos(cam.ph), cam.target.z + cam.r * Math.sin(cam.ph) * Math.cos(cam.th));
    camera.lookAt(cam.target);
    camera.updateMatrixWorld(); // 点选靠它算射线,不等下一帧
  }
  function resize() { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(el);
  // 能转的零件绕着它套的那根棒转(只是画面,占位不变);过了第 3 关才会自己挥
  function swingAxis(p) {
    let rod = null; info.adj.get(p).forEach((k, q) => { if (k === "pin") rod = q; });
    if (!rod) return null;
    const d = L.describe(rod);
    return { c: L2T([0, 1, 2].map((t) => (d.min[t] + d.max[t]) / 2)), axis: U[rod.A] };
  }
  const tmpM = new THREE.Matrix4(), tmpR = new THREE.Matrix4(), tmpT = new THREE.Matrix4();
  function frame(now) {
    const t = now / 1000;
    if (mats.target) mats.target.opacity = 0.3 + 0.35 * Math.sin(t * 4) ** 2;
    const swing = fx().move && !steps.on, spin = new Map(); // 零件 → { c, axis, ang }
    if (swing) {
      for (const p of info.pivots) { const a = swingAxis(p); if (a) spin.set(p, { ...a, ang: 0.7 * Math.sin(t * 2.2) }); }
      for (const tt of info.turntables) {
        const d = L.describe(tt.axis), a = { c: L2T([0, 1, 2].map((k) => (d.min[k] + d.max[k]) / 2)), axis: U[tt.axis.A], ang: 0.9 * Math.sin(t * 1.3) };
        for (const p of [tt.clip, ...tt.carried]) spin.set(p, a);
      }
    }
    meshes.forEach((m) => {
      const piv = spin.get(m.userData.part);
      if (piv) {
        tmpT.makeTranslation(piv.c.x, piv.c.y, piv.c.z);
        tmpR.makeRotationAxis(piv.axis, piv.ang);
        tmpM.makeTranslation(-piv.c.x, -piv.c.y, -piv.c.z);
        m.matrix.copy(tmpT).multiply(tmpR).multiply(tmpM).multiply(m.userData.base);
      } else m.matrix.copy(m.userData.base);
      m.updateMatrixWorld(true);
    });
    meshes.forEach((m) => { // 伙伴:豆条手臂挥手、身上的光一明一暗
      for (const arm of m.userData.arms || []) arm.rotation.z = arm.userData.side * (0.35 + 0.45 * Math.sin(t * 3.2));
      if (m.userData.glow) m.userData.glow.intensity = 0.9 + 0.5 * Math.sin(t * 2.4);
    });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---- 鼠标 ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (steps.on) { st.over = false; return; }
    if (st.tool === "del" || st.tool === "sel") {
      const list = []; meshes.forEach((m) => { if (!m.userData.part.base) list.push(m); });
      const hit = ray.intersectObjects(list, true)[0];
      let o = hit && hit.object; while (o && !o.userData.part) o = o.parent;
      hover = o ? o.userData.part : null;
    } else {
      const pt = new THREE.Vector3(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY());
      if (ray.ray.intersectPlane(pl, pt)) st.cell = [Math.max(-2, Math.min(14, Math.round(pt.x / 10))), Math.max(-2, Math.min(14, Math.round(pt.z / 10)))];
    }
    st.over = true; updateGhost();
  }
  let drag = null;
  el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件没有真指针 */ } pick(e); });
  el.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.moved || Math.abs(dx) + Math.abs(dy) > 5) {
        drag.moved = true; cam.th -= dx * 0.006; cam.ph = Math.max(0.12, Math.min(1.5, cam.ph - dy * 0.006));
        drag.x = e.clientX; drag.y = e.clientY; placeCamera(); return;
      }
    }
    pick(e);
  });
  el.addEventListener("pointerup", (e) => {
    const click = drag && !drag.moved; drag = null;
    if (!click || steps.on) return;
    pick(e);
    if (st.tool === "del") { if (hover) { const h = hover; removePart(h); commit([{ op: "del", part: h }]); refresh(); } return; }
    if (st.tool === "sel") {
      if (!hover) { if (!e.shiftKey) sel.clear(); }
      else if (e.shiftKey) { if (sel.has(hover)) sel.delete(hover); else sel.add(hover); }
      else sel = new Set([hover]);
      refresh(); return;
    }
    const p = current(); if (!p) return;
    const old = p.type === "pal" && palPart();
    if (old) { if (replace([old], [p])) refresh(); return; } // 伙伴只有一个:再放就是搬过去
    if (world.canPlace(p)) { addPart(p); commit([{ op: "add", part: p }]); refresh(); }
  });
  el.addEventListener("pointerleave", () => { if (!drag) { st.over = false; hover = null; updateGhost(); } });
  el.addEventListener("wheel", (e) => { e.preventDefault(); cam.r = Math.max(120, Math.min(700, cam.r * (e.deltaY > 0 ? 1.1 : 0.9))); placeCamera(); }, { passive: false });

  // ---- 按钮、键盘 ----
  function setTool(t) { if (!unlocked(t)) return; hover = null; stopSteps(); st.tool = t; if (t !== "sel") sel.clear(); refresh(); }
  function bump(k, d) {
    const t = st.tool; if (!free || !isPartTool(t) || t === "pal") return;
    if (k === "n") st.n[t] = Math.max(LIM[t][0], Math.min(LIM[t][1], st.n[t] + d));
    if (k === "h") st.h = Math.max(0, Math.min(12, st.h + d));
    if (k === "s" && t !== "rod") st.s = (st.s + d + 4) % 4;
    st.over = true; refresh();
  }
  function rotate() { const t = st.tool; if (!free || !isPartTool(t)) return; st.ori[t] = (st.ori[t] + 1) % ORI[t].length; st.over = true; refresh(); }
  $("tools").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) setTool(b.dataset.tool); });
  for (const [id, k] of [["st-n", "n"], ["st-h", "h"], ["st-s", "s"]]) $(id).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) bump(k, +b.dataset.d); });
  $("rot").addEventListener("click", rotate);
  $("undo").addEventListener("click", undo);
  $("redo").addEventListener("click", redo);
  $("clear").addEventListener("click", () => {
    const olds = userParts(); if (!olds.length) return;
    olds.forEach(removePart); commit(olds.map((p) => ({ op: "del", part: p }))); stopSteps(); refresh();
  });
  $("move").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) moveSel(b.dataset.m.split(",").map(Number)); });
  $("group").addEventListener("click", groupSel);
  $("copy").addEventListener("click", copySel);
  $("delSel").addEventListener("click", delSel);
  $("stepGo").addEventListener("click", startSteps);
  $("stepExit").addEventListener("click", () => { stopSteps(); refresh(); });
  $("stepPrev").addEventListener("click", () => setStep(steps.k - 1));
  $("stepNext").addEventListener("click", () => setStep(steps.k + 1));
  $("stepRange").addEventListener("input", (e) => setStep(+e.target.value));
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (steps.on) {
      if (k === "arrowleft") { setStep(steps.k - 1); e.preventDefault(); }
      else if (k === "arrowright") { setStep(steps.k + 1); e.preventDefault(); }
      else if (k === "escape") { stopSteps(); refresh(); }
      return;
    }
    if (st.tool === "sel" && sel.size) {
      const mv = { arrowleft: [-1, 0, 0], arrowright: [1, 0, 0], arrowup: [0, -1, 0], arrowdown: [0, 1, 0], pageup: [0, 0, 1], pagedown: [0, 0, -1] }[k];
      if (mv) { e.preventDefault(); moveSel(mv); return; }
      if (k === "c") { copySel(); return; }
      if (k === "g") { groupSel(); return; }
      if (k === "delete" || k === "backspace") { e.preventDefault(); delSel(); return; }
      if (k === "escape") { sel.clear(); refresh(); return; }
    }
    if (k === "r") rotate(); else if (k === "z") undo(); else if (k === "y") redo();
    else if (k === "q") bump("h", -1); else if (k === "e") bump("h", 1);
  });
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---- 开始 ----
  applyTheme();
  L.boardParts().forEach(addPart);
  for (const o of Array.isArray(saved.parts) ? saved.parts : []) if (valid(o) && inBounds(o) && world.canPlace(hydrate(o))) addPart(hydrate(plain(o)));
  // 技能实时同步:别的标签页过了关(或换了伙伴),这里马上跟着变
  window.addEventListener("storage", (e) => {
    if (e.key === "mb.levels") applySkills();
    else if (e.key === "mb.card") location.reload();
  });
  if (palPart()) { cam.r = 300; cam.target.set(60, 34, 60); } // 伙伴站着的话,镜头退一点,整个都看得见
  placeCamera(); resize();
  renderBeadColors();
  refresh();
  requestAnimationFrame(frame);
})();
