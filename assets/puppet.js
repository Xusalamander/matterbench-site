// 第 3 关:会动的豆条小人。
// 每个零件是一根豆条(一排豆)或一小块豆片;关节 = 一根销子穿过父零件的某个孔和子零件的某个孔,子零件绕它转。
// 零件分层叠放:连在同一个关节上的两件必须不同层;同一层里的零件不能叠在一起。
// 单位:1 = 一颗豆的间距。角度:度,0 = 朝右,90 = 朝下(屏幕坐标)。
(() => {
  "use strict";
  const DEG = Math.PI / 180;
  const $ = (s) => document.querySelector(s);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const storage = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密窗口等 */ } },
  };
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const isLight = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.67; };
  // 豆子描边:颜色和底色太接近(深色底上的黑豆、浅色底上的白豆、黄豆)时描一圈明显的边
  const lum = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
  const rim = (c, bg) => (Math.abs(lum(c) - lum(bg)) < 0.22
    ? (lum(bg) > 0.5 ? "rgba(0,0,0,.42)" : "rgba(255,255,255,.5)")
    : isLight(c) ? "rgba(0,0,0,.2)" : "rgba(255,255,255,.18)");
  const PALETTE = ["#16181D", "#FFFFFF", "#F6E7DA", "#E5484D", "#F28B2E", "#F5D547", "#C6F04A", "#3DB86B", "#1F8FA6", "#3E63DD", "#8E4EC6", "#8B5A3C"];

  // ---- 零件形状 ----
  // strip:一排 len 颗,沿本地 +x;孔 0 就是它自己的转轴。plate:一块豆片,cells 里 [0,0] 是转轴那颗。
  const cellsOf = (p) => (p.kind === "strip" ? Array.from({ length: p.len }, (_, i) => [i, 0]) : p.cells);
  // 子零件挂在父零件的哪个孔:"end" = 豆条最后一颗;数组 = 豆片上那颗的坐标;数字 = 第几颗
  function atCell(parent, at) {
    const cs = cellsOf(parent);
    if (at === "end") return cs[cs.length - 1];
    if (Array.isArray(at)) return at;
    return cs[Math.min(at, cs.length - 1)];
  }
  function plate(rows) { // rows:从上到下的字符串,"o" = 豆,"P" = 转轴那颗;其余字母 = 带颜色的豆
    let px = 0, py = 0;
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "P") { px = x; py = y; } }));
    const cells = [], marks = {};
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === ".") return;
      const c = [x - px, y - py];
      cells.push(c);
      if (ch !== "o" && ch !== "P") marks[c.join(",")] = ch;
    }));
    return { cells, marks };
  }

  // ---- 模板 ----
  const HEAD = plate([".ooo.", "oEoEo", "ooooo", "ooMoo", ".oPo."]);
  const DOGHEAD = plate(["o....", "ooEo.", "ooooN", "Pooo."]);
  const BASE = plate(["ooPoo", "ooooo"]);
  const MARK_COLORS = { E: "#16181D", M: "#E5484D", N: "#16181D" };

  const TEMPLATES = {
    person: {
      name: "小人",
      root: { x: 0, y: -6 },
      // 左大臂故意放在和身体同一层:第一个任务就是把它挪开
      pieces: [
        { id: "torso", name: "身体", kind: "strip", len: 6, parent: null, rest: 90, layer: 0, color: "#1F8FA6" },
        { id: "head", name: "头", kind: "plate", ...HEAD, parent: "torso", at: 0, rest: -90, layer: -1, color: "#F5D547" },
        { id: "rUpper", name: "右大臂", kind: "strip", len: 3, parent: "torso", at: 1, rest: -40, layer: 1, color: "#E5484D" },
        { id: "rFore", name: "右小臂", kind: "strip", len: 3, parent: "rUpper", at: "end", rest: -15, layer: 2, color: "#F28B2E" },
        { id: "lUpper", name: "左大臂", kind: "strip", len: 3, parent: "torso", at: 1, rest: 40, layer: 0, color: "#E5484D" },
        { id: "lFore", name: "左小臂", kind: "strip", len: 3, parent: "lUpper", at: "end", rest: 15, layer: -2, color: "#F28B2E" },
        { id: "rThigh", name: "右大腿", kind: "strip", len: 4, parent: "torso", at: "end", rest: -15, layer: 1, color: "#3E63DD" },
        { id: "rShin", name: "右小腿", kind: "strip", len: 4, parent: "rThigh", at: "end", rest: 0, layer: 2, color: "#16181D" },
        { id: "lThigh", name: "左大腿", kind: "strip", len: 4, parent: "torso", at: "end", rest: 15, layer: -1, color: "#3E63DD" },
        { id: "lShin", name: "左小腿", kind: "strip", len: 4, parent: "lThigh", at: "end", rest: 0, layer: -2, color: "#16181D" },
      ],
      anims: [
        { id: "wave", name: "挥手", f: (t) => {
          const up = Math.min(1, t / 0.5);
          return { rUpper: -100 * up, rFore: up * (-35 + 30 * Math.sin(t * 7)) };
        } },
        { id: "jack", name: "开合跳", f: (t) => {
          const s = (1 - Math.cos(t * Math.PI * 2)) / 2;
          return { rUpper: -50 * s, lUpper: 50 * s, rFore: -20 * s, lFore: 20 * s, rThigh: -16 * s, lThigh: 16 * s, _dy: -0.8 * Math.sin(t * Math.PI * 2 / 2) ** 2 };
        } },
      ],
    },
    dog: {
      name: "小狗",
      root: { x: -3.5, y: -1 },
      pieces: [
        { id: "body", name: "身体", kind: "strip", len: 7, parent: null, rest: 0, layer: 0, color: "#8B5A3C" },
        { id: "head", name: "头", kind: "plate", ...DOGHEAD, parent: "body", at: "end", rest: 0, layer: 1, color: "#C08457" },
        { id: "tail", name: "尾巴", kind: "strip", len: 3, parent: "body", at: 0, rest: 200, layer: -1, color: "#C08457" },
        { id: "nf", name: "前腿(近)", kind: "strip", len: 3, parent: "body", at: 5, rest: 90, layer: 1, color: "#6B4430" },
        { id: "ff", name: "前腿(远)", kind: "strip", len: 3, parent: "body", at: 5, rest: 90, layer: -1, color: "#4E3123" },
        { id: "nb", name: "后腿(近)", kind: "strip", len: 3, parent: "body", at: 1, rest: 90, layer: 1, color: "#6B4430" },
        { id: "fb", name: "后腿(远)", kind: "strip", len: 3, parent: "body", at: 1, rest: 90, layer: -1, color: "#4E3123" },
      ],
      anims: [
        { id: "walk", name: "走路", f: (t) => {
          const s = Math.sin(t * 5);
          return { nf: 25 * s, fb: 25 * s, ff: -25 * s, nb: -25 * s, tail: 8 * Math.sin(t * 10), head: 4 * Math.sin(t * 10) };
        } },
        { id: "wag", name: "摇尾巴", f: (t) => ({ tail: 35 * Math.sin(t * 12), head: -4 + 4 * Math.sin(t * 3) }) },
      ],
    },
    arm: {
      name: "机械臂",
      root: { x: -2, y: 4 },
      pieces: [
        { id: "base", name: "底座", kind: "plate", ...BASE, parent: null, rest: 0, layer: 0, color: "#3E63DD" },
        { id: "arm1", name: "大臂", kind: "strip", len: 5, parent: "base", at: [0, 0], rest: -70, layer: 1, color: "#F28B2E" },
        { id: "arm2", name: "小臂", kind: "strip", len: 4, parent: "arm1", at: "end", rest: 70, layer: 2, color: "#F5D547" },
        { id: "fTop", name: "上夹爪", kind: "strip", len: 2, parent: "arm2", at: "end", rest: -30, layer: 1, color: "#1F8FA6" },
        { id: "fBot", name: "下夹爪", kind: "strip", len: 2, parent: "arm2", at: "end", rest: 30, layer: 3, color: "#1F8FA6" },
      ],
      anims: [
        { id: "grab", name: "抓取", f: (t) => {
          const s = (1 - Math.cos(t * Math.PI * 2 / 2.4)) / 2;
          return { arm1: 25 * s, arm2: 35 * s, fTop: 18 * s, fBot: -18 * s };
        } },
        { id: "hello", name: "打招呼", f: (t) => ({ arm1: -10, arm2: 30 * Math.sin(t * 4), fTop: -10, fBot: 10 }) },
      ],
    },
  };

  // ---- 状态 ----
  let tplId = "person", tpl = TEMPLATES[tplId];
  let pieces = [], pose = {}, root = { x: 0, y: 0 };
  let selected = null, look = "normal", anim = null, animT0 = 0;
  const history = [];
  const flags = { layerChanged: false };

  function loadTemplate(id, saved) {
    tplId = id; tpl = TEMPLATES[id];
    pieces = tpl.pieces.map((p) => ({ ...p, cells: p.cells && p.cells.map((c) => c.slice()) }));
    pose = {}; root = { ...tpl.root };
    if (saved && saved.tpl === id) {
      for (const p of pieces) Object.assign(p, saved.mods?.[p.id] || {});
      pose = saved.pose || {};
      if (saved.root) root = saved.root;
    }
    selected = null; stopAnim();
    document.querySelectorAll("#templates [data-tpl]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tpl === id)));
    renderAnims();
    fit();
  }
  const byId = (id) => pieces.find((p) => p.id === id);
  const snapshot = () => JSON.stringify({ tpl: tplId, mods: Object.fromEntries(pieces.map((p) => [p.id, { len: p.len, color: p.color, layer: p.layer }])), pose, root });
  function pushHistory() { history.push(snapshot()); if (history.length > 80) history.shift(); }
  function undo() {
    const s = history.pop(); if (!s) return;
    const o = JSON.parse(s);
    if (o.tpl !== tplId) loadTemplate(o.tpl, o); else { for (const p of pieces) Object.assign(p, o.mods[p.id] || {}); pose = o.pose; root = o.root; }
    refresh();
  }
  const save = () => storage.set("mb.demo.puppet", JSON.parse(snapshot()));

  // ---- 解算:每个零件的世界位置和朝向 ----
  function solve(withAnim = true) {
    const off = withAnim && anim ? anim.f((performance.now() - animT0) / 1000) : {};
    const out = {};
    for (const p of pieces) {
      const ang = p.rest + (pose[p.id] || 0) + (off[p.id] || 0);
      if (!p.parent) { out[p.id] = { x: root.x, y: root.y + (off._dy || 0), a: ang * DEG }; continue; }
      const par = out[p.parent], c = atCell(byId(p.parent), p.at);
      out[p.id] = {
        x: par.x + c[0] * Math.cos(par.a) - c[1] * Math.sin(par.a),
        y: par.y + c[0] * Math.sin(par.a) + c[1] * Math.cos(par.a),
        a: par.a + ang * DEG,
      };
    }
    return out;
  }
  const cellWorld = (f, c) => [f.x + c[0] * Math.cos(f.a) - c[1] * Math.sin(f.a), f.y + c[0] * Math.sin(f.a) + c[1] * Math.cos(f.a)];
  const layerOffset = (layer) => (look === "layers" ? [layer * 0.55, -layer * 0.4] : [0, 0]);

  // ---- 检查:同一关节同层 / 同层叠在一起 ----
  function check(frames) {
    const issues = [], bad = new Set();
    for (const p of pieces) {
      if (!p.parent) continue;
      const par = byId(p.parent);
      if (p.layer === par.layer) {
        issues.push({ kind: "joint", id: p.id, text: `「${p.name}」和「${par.name}」在同一层(${layerName(p.layer)}),销子穿不过去 → 把「${p.name}」往前或往后挪一层` });
        bad.add(p.id); bad.add(par.id);
      }
    }
    const pts = pieces.map((p) => cellsOf(p).map((c) => cellWorld(frames[p.id], c)));
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if (a.layer !== b.layer || a.parent === b.id || b.parent === a.id) continue;
      let hit = false;
      for (const p of pts[i]) { for (const q of pts[j]) { if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.9) { hit = true; break; } } if (hit) break; }
      if (hit) {
        issues.push({ kind: "overlap", id: a.id, text: `「${a.name}」和「${b.name}」都在${layerName(a.layer)},叠在一起会撞 → 换一层` });
        bad.add(a.id); bad.add(b.id);
      }
    }
    return { issues, bad };
  }
  const layerName = (l) => (l === 0 ? "中间层" : l > 0 ? `前 ${l} 层` : `后 ${-l} 层`);

  // ---- 画 ----
  const cv = $("#stage"), ctx = cv.getContext("2d");
  let view = { s: 20, cx: 0, cy: 0, w: 0, h: 0, dpr: 1 };
  function fit() {
    const st = $("#stage2d"), dpr = window.devicePixelRatio || 1;
    const w = Math.max(240, st.clientWidth), h = Math.max(240, st.clientHeight);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const fr = solve(false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pieces) for (const c of cellsOf(p)) {
      const [x, y] = cellWorld(fr[p.id], c);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    // 留出动画和摆姿势的余地
    const bw = x1 - x0 + 7, bh = y1 - y0 + 7;
    const s = Math.min(w / bw, (h - 60) / bh, 46);
    view = { s, cx: w / 2 - ((x0 + x1) / 2) * s, cy: (h - 30) / 2 - ((y0 + y1) / 2) * s, w, h, dpr };
  }
  const toScreen = (x, y) => [view.cx + x * view.s, view.cy + y * view.s];

  function draw(frames, result) {
    const { s, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    // 底下一层淡淡的格子
    ctx.fillStyle = css("--dot");
    for (let gx = view.cx % s; gx < view.w; gx += s) for (let gy = view.cy % s; gy < view.h; gy += s) { ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5); }

    const order = pieces.map((p, i) => ({ p, i })).sort((a, b) => a.p.layer - b.p.layer || a.i - b.i);
    const r = s * 0.46, bg = css("--view");
    for (const { p } of order) {
      const f = frames[p.id], [ox, oy] = layerOffset(p.layer);
      const isBad = result.bad.has(p.id), isSel = selected === p.id;
      // 影子:看得出谁压在谁上面
      ctx.fillStyle = "rgba(0,0,0,.35)";
      for (const c of cellsOf(p)) { const [x, y] = cellWorld(f, c); const [sx, sy] = toScreen(x + ox, y + oy); ctx.beginPath(); ctx.arc(sx + s * 0.08, sy + s * 0.1, r, 0, Math.PI * 2); ctx.fill(); }
      for (const c of cellsOf(p)) {
        const [x, y] = cellWorld(f, c), [sx, sy] = toScreen(x + ox, y + oy);
        const mark = p.marks && p.marks[c.join(",")];
        const col = mark ? MARK_COLORS[mark] : p.color;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = isBad || isSel ? Math.max(2, s * 0.09) : Math.max(1, s * 0.04);
        ctx.strokeStyle = isBad ? "#FF4D52" : isSel ? "#C6F04A" : rim(col, bg);
        ctx.stroke();
        ctx.fillStyle = isLight(col) ? "rgba(0,0,0,.2)" : "rgba(255,255,255,.22)";
        ctx.beginPath(); ctx.arc(sx, sy, s * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      if (look === "layers") { // 分层看:在零件第一颗旁标层号
        const [x, y] = cellWorld(f, cellsOf(p)[0]), [sx, sy] = toScreen(x + ox, y + oy);
        ctx.fillStyle = css("--text-2"); ctx.font = `600 ${Math.max(10, s * 0.42)}px ${css("--mono")}`;
        ctx.fillText(p.layer > 0 ? `+${p.layer}` : String(p.layer), sx + r * 1.1, sy - r * 1.1);
      }
    }
    // 销子(关节):正常看是一个点,分层看是一根连过各层的短棍
    for (const p of pieces) {
      if (!p.parent) continue;
      const par = byId(p.parent), f = frames[p.id];
      const [ax, ay] = layerOffset(par.layer), [bx, by] = layerOffset(p.layer);
      const [s1x, s1y] = toScreen(f.x + ax, f.y + ay), [s2x, s2y] = toScreen(f.x + bx, f.y + by);
      const bad = p.layer === par.layer;
      if (look === "layers") {
        ctx.strokeStyle = bad ? "#FF4D52" : "#C9CCD2"; ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(s1x, s1y); ctx.lineTo(s2x, s2y); ctx.stroke();
      }
      for (const [x, y] of [[s1x, s1y], [s2x, s2y]]) {
        ctx.fillStyle = bad ? "#FF4D52" : "#D9DCE1";
        ctx.beginPath(); ctx.arc(x, y, s * 0.19, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6F747D";
        ctx.beginPath(); ctx.arc(x, y, s * 0.07, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---- 每帧 ----
  let lastResult = { issues: [], bad: new Set() };
  function frame() {
    const frames = solve();
    lastResult = check(frames);
    draw(frames, lastResult);
    return frames;
  }
  function loop() { frame(); if (anim) requestAnimationFrame(loop); }
  function refresh() {
    frame();
    renderEditor(); renderLayers(); save();
    const n = pieces.length, joints = pieces.filter((p) => p.parent).length;
    const layers = new Set(pieces.map((p) => p.layer)).size;
    const beads = pieces.reduce((s, p) => s + cellsOf(p).length, 0);
    $("#statusInfo").textContent = lastResult.issues.length
      ? `⚠ ${lastResult.issues.length} 个问题:${lastResult.issues[0].text}`
      : `${tpl.name} · ${n} 个零件 · ${beads} 颗豆 · ${joints} 个关节 · ${layers} 层`;
    if (flags.layerChanged && !lastResult.issues.some((i) => i.kind === "joint") && !lastResult.issues.length) quest.done("fix");
  }

  // ---- 拖动:四肢绕孔转,身体整个移动 ----
  function hit(px, py) {
    const frames = solve();
    const order = pieces.map((p, i) => ({ p, i })).sort((a, b) => b.p.layer - a.p.layer || b.i - a.i);
    for (const { p } of order) {
      const [ox, oy] = layerOffset(p.layer);
      for (const c of cellsOf(p)) {
        const [x, y] = cellWorld(frames[p.id], c), [sx, sy] = toScreen(x + ox, y + oy);
        if (Math.hypot(px - sx, py - sy) < view.s * 0.55) return { p, frames };
      }
    }
    return null;
  }
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const rect = cv.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
    const h = hit(px, py);
    if (!h) { selected = null; refresh(); return; }
    e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.classList.add("dragging");
    const f = h.frames[h.p.id], [ox, oy] = layerOffset(h.p.layer), [pvx, pvy] = toScreen(f.x + ox, f.y + oy);
    drag = { id: h.p.id, root: !h.p.parent, px, py, pvx, pvy, start: Math.atan2(py - pvy, px - pvx), pose0: pose[h.p.id] || 0, root0: { ...root }, moved: false, snap: snapshot() };
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const rect = cv.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
    if (!drag.moved && Math.hypot(px - drag.px, py - drag.py) < 4) return;
    drag.moved = true;
    if (drag.root) {
      root = { x: drag.root0.x + (px - drag.px) / view.s, y: drag.root0.y + (py - drag.py) / view.s };
    } else {
      let d = (Math.atan2(py - drag.pvy, px - drag.pvx) - drag.start) / DEG;
      d = ((d + 540) % 360) - 180;
      pose[drag.id] = drag.pose0 + d;
      if (Math.abs(d) > 15) quest.done("pose");
    }
    frame();
  });
  const endDrag = () => {
    if (!drag) return;
    cv.classList.remove("dragging");
    if (drag.moved) { history.push(drag.snap); } else { selected = drag.id; }
    drag = null;
    refresh();
  };
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  // ---- 侧栏 ----
  function renderAnims() {
    const box = $("#anims"); box.innerHTML = "";
    for (const a of tpl.anims) {
      const b = document.createElement("button");
      b.textContent = "▶ " + a.name;
      b.setAttribute("aria-pressed", String(anim === a));
      b.addEventListener("click", () => { if (anim === a) stopAnim(); else startAnim(a); });
      box.appendChild(b);
    }
  }
  function startAnim(a) { anim = a; animT0 = performance.now(); renderAnims(); quest.done("play"); loop(); }
  function stopAnim() { anim = null; if (typeof renderAnims === "function" && tpl) renderAnims(); if (pieces.length) refresh(); }

  function renderEditor() {
    const p = selected && byId(selected);
    $("#selEmpty").hidden = !!p; $("#selBox").hidden = !p;
    if (!p) return;
    $("#selName").textContent = p.name;
    $("#selInfo").textContent = `${p.kind === "strip" ? "豆条" : "豆片"} · ${cellsOf(p).length} 颗 · ${p.parent ? "绕孔转" : "拖它能整个移动"}`;
    $("#selLayer").textContent = layerName(p.layer);
    const issue = lastResult.issues.find((it) => it.id === p.id || (it.kind === "joint" && byId(it.id).parent === p.id));
    $("#selHint").hidden = !issue;
    if (issue) $("#selHint").textContent = issue.text;
    $("#lenRow").hidden = p.kind !== "strip";
    $("#lenMinus").disabled = p.len <= 2; $("#lenPlus").disabled = p.len >= 8;
    const box = $("#selColors"); box.innerHTML = "";
    for (const c of PALETTE) {
      const b = document.createElement("button");
      b.className = "swatch"; b.style.background = c; b.title = c;
      b.setAttribute("aria-label", "颜色 " + c); b.setAttribute("aria-pressed", String(c === p.color));
      b.addEventListener("click", () => { pushHistory(); p.color = c; quest.done("color"); refresh(); });
      box.appendChild(b);
    }
  }
  function renderLayers() {
    const box = $("#layerList"); box.innerHTML = "";
    const layers = [...new Set(pieces.map((p) => p.layer))].sort((a, b) => b - a);
    for (const l of layers) {
      const row = document.createElement("div"); row.className = "layer-line";
      row.innerHTML = `<span>${l === 0 ? "中间" : l > 0 ? "前 " + l : "后 " + -l}</span><div class="chips-s"></div>`;
      for (const p of pieces.filter((q) => q.layer === l)) {
        const b = document.createElement("button");
        b.textContent = p.name;
        b.setAttribute("aria-pressed", String(selected === p.id));
        if (lastResult.bad.has(p.id)) b.classList.add("bad");
        b.addEventListener("click", () => { selected = p.id; refresh(); });
        row.lastChild.appendChild(b);
      }
      box.appendChild(row);
    }
    const ul = $("#checks"); ul.innerHTML = "";
    const items = lastResult.issues.length ? lastResult.issues : [{ kind: "ok", text: "层都排好了:每个关节的两件在不同层,同一层里没有叠在一起的。" }];
    for (const it of items.slice(0, 4)) {
      const li = document.createElement("li"); li.className = it.kind === "ok" ? "" : "bad"; li.textContent = it.text;
      if (it.id && it.id !== selected) {
        const b = document.createElement("button"); b.className = "check-go"; b.textContent = "选中它";
        b.addEventListener("click", () => { selected = it.id; setLook("layers"); refresh(); $("#editor").scrollIntoView({ block: "nearest", behavior: "smooth" }); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
  }

  function changeLen(d) {
    const p = selected && byId(selected); if (!p || p.kind !== "strip") return;
    const n = Math.max(2, Math.min(8, p.len + d)); if (n === p.len) return;
    pushHistory(); p.len = n; quest.done("color"); refresh();
  }
  function changeLayer(d) {
    const p = selected && byId(selected); if (!p) return;
    const n = Math.max(-4, Math.min(4, p.layer + d)); if (n === p.layer) return;
    pushHistory(); p.layer = n; flags.layerChanged = true; refresh();
  }
  $("#lenMinus").addEventListener("click", () => changeLen(-1));
  $("#lenPlus").addEventListener("click", () => changeLen(1));
  $("#layerBack").addEventListener("click", () => changeLayer(-1));
  $("#layerFront").addEventListener("click", () => changeLayer(1));
  $("#resetPose").addEventListener("click", () => { pushHistory(); pose = {}; root = { ...tpl.root }; stopAnim(); refresh(); });
  $("#undo").addEventListener("click", undo);
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); } });
  document.querySelectorAll("#templates [data-tpl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.tpl === tplId) return;
    pushHistory(); loadTemplate(b.dataset.tpl); refresh(); pickProblem();
  }));
  function setLook(v) {
    look = v;
    document.querySelectorAll("[data-look]").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.look === v)));
  }
  document.querySelectorAll("[data-look]").forEach((b) => b.addEventListener("click", () => { setLook(b.dataset.look); refresh(); }));
  // 一进来有标红的问题,就先替他选中那根豆条,右边直接出现「往后一层 / 往前一层」
  function pickProblem() { const it = lastResult.issues[0]; if (it && !selected) { selected = it.id; refresh(); } }

  // ---- 带走:拼装图 ----
  $("#dlPng").addEventListener("click", () => {
    const W = 1240, H = 760, out = document.createElement("canvas");
    out.width = W; out.height = H;
    const g = out.getContext("2d");
    g.fillStyle = "#FBFBF8"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#16181D"; g.font = "bold 26px sans-serif";
    g.fillText(`豆条${tpl.name} · 拼装图`, 40, 54);
    // 左边:分层摆开的样子
    const fr = solve(false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pieces) for (const c of cellsOf(p)) { const [x, y] = cellWorld(fr[p.id], c); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const s = Math.min(560 / (x1 - x0 + 4), 600 / (y1 - y0 + 4));
    const ox = 40 + 300 - ((x0 + x1) / 2) * s, oy = 100 + 320 - ((y0 + y1) / 2) * s;
    const order = pieces.map((p, i) => ({ p, i })).sort((a, b) => a.p.layer - b.p.layer || a.i - b.i);
    for (const { p } of order) for (const c of cellsOf(p)) {
      const [x, y] = cellWorld(fr[p.id], c), sx = ox + x * s, sy = oy + y * s;
      const mark = p.marks && p.marks[c.join(",")], col = mark ? MARK_COLORS[mark] : p.color;
      g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.arc(sx + 2, sy + 3, s * 0.46, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(sx, sy, s * 0.46, 0, Math.PI * 2); g.fill();
      g.fillStyle = isLight(col) ? "rgba(0,0,0,.2)" : "rgba(255,255,255,.25)"; g.beginPath(); g.arc(sx, sy, s * 0.16, 0, Math.PI * 2); g.fill();
    }
    for (const p of pieces) if (p.parent) {
      const f = fr[p.id]; g.fillStyle = "#6F747D"; g.beginPath(); g.arc(ox + f.x * s, oy + f.y * s, s * 0.16, 0, Math.PI * 2); g.fill();
    }
    // 右边:零件清单,从后往前装
    let y = 110; const X = 700;
    g.font = "bold 18px sans-serif"; g.fillStyle = "#16181D"; g.fillText("零件(从后往前装)", X, y); y += 14;
    const sorted = pieces.slice().sort((a, b) => a.layer - b.layer);
    g.font = "15px sans-serif";
    for (const p of sorted) {
      y += 30;
      g.fillStyle = p.color; g.beginPath(); g.arc(X + 9, y - 5, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#16181D";
      g.fillText(`${p.name}  ·  ${p.kind === "strip" ? "豆条" : "豆片"} ${cellsOf(p).length} 颗  ·  ${layerName(p.layer)}`, X + 28, y);
    }
    y += 44;
    const joints = pieces.filter((p) => p.parent).length;
    g.fillStyle = "#6B7079"; g.font = "15px sans-serif";
    g.fillText(`关节 ${joints} 个:每个关节一根销子,穿过两件上对齐的孔。`, X, y);
    g.fillText("连在同一个关节上的两件放在不同层;同一层里不要叠在一起。", X, y + 26);
    g.fillText("图里灰色的点就是关节的位置。", X, y + 52);
    g.fillStyle = "#9CA1AA"; g.font = "12px sans-serif"; g.fillText("由 MatterBench 在线体验生成", 40, H - 24);
    out.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `豆条${tpl.name}拼装图.png`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  });

  // ---- 本关任务 ----
  const quest = MBQuest.init({
    level: "puppet",
    tasks: [
      { id: "fix", label: "把标红的豆条换到另一层(选中它,点「往后一层」)" },
      { id: "color", label: "点一根豆条,换个颜色或长短" },
      { id: "pose", label: "拖动四肢,摆个姿势" },
      { id: "play", label: "让它动起来" },
    ],
  });

  window.addEventListener("resize", () => { fit(); refresh(); });
  const saved = storage.get("mb.demo.puppet");
  loadTemplate(saved && TEMPLATES[saved.tpl] ? saved.tpl : "person", saved);
  refresh();
  pickProblem();
})();
