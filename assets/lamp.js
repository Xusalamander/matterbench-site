// MatterBench 在线体验:拼豆灯罩。四面拼豆图案 + ESP32 驱动的四块 8×8 RGB 灯板。
// 展开图(2D)里画图案,开灯看透光效果;3D 在 viewer3d.js(加载完挂 window.MB3D,派发 mb3d-ready)。
// 灯效算法和导出的 ESP32 代码(buildSketch)一一对应,改一边记得改另一边。
(() => {
  "use strict";

  const F = 4, N = 16, LED = 8, CELLS = F * N * N;
  const FACE_NAMES = ["前面", "右面", "后面", "左面"];
  const FX = ["solid", "breathe", "rainbow", "rise", "twinkle"];
  const FX_NAMES = { solid: "常亮", breathe: "呼吸", rainbow: "彩虹环绕", rise: "流光上升", twinkle: "星光闪烁" };

  const $ = (s) => document.querySelector(s);
  const storage = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密窗口等 */ } },
  };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---- 颜色工具 ----
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgbToHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
  const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const isLight = (hex) => luma(hexToRgb(hex)) > 0.67;
  const toCss = (r, g, b) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  function hsv(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  }
  // 和 ESP32 代码里的 hash32 一样
  function hash32(a) {
    a >>>= 0;
    a ^= a >>> 16; a = Math.imul(a, 0x7feb352d) >>> 0;
    a ^= a >>> 15; a = Math.imul(a, 0x846ca68b) >>> 0;
    a ^= a >>> 16;
    return a >>> 0;
  }

  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // =====================================================================
  // 状态
  // =====================================================================
  const PRESET = ["#16181D", "#FFFFFF", "#F6E7DA", "#E5484D", "#F28B2E", "#F5D547", "#C6F04A", "#3DB86B", "#1F8FA6", "#3E63DD", "#8E4EC6", "#F2A7C3"];
  const saved = storage.get("mb.demo.lamp");
  const work = {
    cells: Array.isArray(saved?.cells) && saved.cells.length === CELLS ? saved.cells : new Array(CELLS).fill(null),
    palette: saved?.palette || PRESET.slice(),
    color: "#F5D547",
    tool: "pen",
    face: 0,
  };
  const light = Object.assign({ on: false, fx: "solid", color: "#FFB65C", bright: 70, speed: 4 }, saved?.light || {}, { on: false });
  const ui = { view: "2d", showGrid: true };

  // ---- 本关任务 ----
  const quest = MBQuest.init({
    level: "lamp",
    tasks: [
      { id: "template", label: "挑一个灯罩模板" },
      { id: "lightOn", label: "开灯看看效果" },
      { id: "view3d", label: "切到 3D 灯罩转一圈" },
      { id: "code", label: "下载 ESP32 代码" },
    ],
    next: { href: "puppet.html", label: "下一关:会动的豆条小人" },
  });

  // ---- 撤销 / 重做(只管图案) ----
  const snap = () => JSON.stringify({ cells: work.cells, palette: work.palette });
  const hist = { undo: [], redo: [], prev: snap() };
  function commit() {
    const now = snap();
    if (now === hist.prev) return;
    hist.undo.push(hist.prev);
    if (hist.undo.length > 80) hist.undo.shift();
    hist.redo = [];
    hist.prev = now;
    syncHistoryButtons();
  }
  function restore(s) { Object.assign(work, JSON.parse(s)); renderPalette(); update(); }
  function undo() { if (!hist.undo.length) return; hist.redo.push(snap()); hist.prev = hist.undo.pop(); restore(hist.prev); }
  function redo() { if (!hist.redo.length) return; hist.undo.push(snap()); hist.prev = hist.redo.pop(); restore(hist.prev); }
  function syncHistoryButtons() { $("#undo").disabled = !hist.undo.length; $("#redo").disabled = !hist.redo.length; }
  $("#undo").addEventListener("click", undo);
  $("#redo").addEventListener("click", redo);
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (!(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") { setLamp(!light.on); return; }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
  });
  $("#clear").addEventListener("click", () => { work.cells.fill(null); commit(); update(); });

  // =====================================================================
  // 灯效:第 f 块灯板 (lx, ly) 那颗灯珠在 t 秒时的颜色,0–1。ly 从上往下
  // =====================================================================
  function ledAt(f, lx, ly, t) {
    const [br, bg, bb] = hexToRgb(light.color).map((v) => v / 255);
    const sp = light.speed;
    let r = br, g = bg, b = bb;
    if (light.fx === "breathe") {
      const k = 0.2 + 0.8 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * 0.06 * sp));
      r *= k; g *= k; b *= k;
    } else if (light.fx === "rainbow") {
      let h = (f * LED + lx) / (F * LED) + t * 0.05 * sp;
      h -= Math.floor(h);
      [r, g, b] = hsv(h, 1, 1);
    } else if (light.fx === "rise") {
      const ph = ly / LED + t * 0.12 * sp;
      const s = 0.5 + 0.5 * Math.sin(2 * Math.PI * ph);
      const k = 0.15 + 0.85 * s * s;
      r *= k; g *= k; b *= k;
    } else if (light.fx === "twinkle") {
      const id = (f * LED + ly) * LED + lx;
      const s = t * 0.8 * sp + (hash32(id) % 1000) / 1000;
      const step = Math.floor(s), fr = s - step;
      const base = [r * 0.3, g * 0.3, b * 0.3];
      if (hash32((id * 7919 + step) >>> 0) % 100 < 12) {
        const spark = [Math.min(1, r + 60 / 255), Math.min(1, g + 60 / 255), Math.min(1, b + 60 / 255)];
        [r, g, b] = spark.map((v, i) => v + (base[i] - v) * fr);
      } else [r, g, b] = base;
    }
    const k = light.bright / 100;
    return [r * k, g * k, b * k];
  }

  const ledBuf = new Float32Array(F * LED * LED * 3);
  const cellBuf = new Float32Array(CELLS * 3);
  // 算一帧:灯珠颜色 + 每格透光后的样子(拼豆半透明:透过的光 ≈ 灯光 × (一成多与颜色无关 + 其余按豆子颜色);空格直接看到灯板)
  function computeFrame(t) {
    for (let f = 0; f < F; f++) for (let ly = 0; ly < LED; ly++) for (let lx = 0; lx < LED; lx++) {
      const c = ledAt(f, lx, ly, t), j = (f * LED * LED + ly * LED + lx) * 3;
      ledBuf[j] = c[0]; ledBuf[j + 1] = c[1]; ledBuf[j + 2] = c[2];
    }
    for (let i = 0; i < CELLS; i++) {
      const f = (i / (N * N)) | 0, y = ((i % (N * N)) / N) | 0, x = i % N;
      const j = (f * LED * LED + (y >> 1) * LED + (x >> 1)) * 3;
      const L = [ledBuf[j], ledBuf[j + 1], ledBuf[j + 2]];
      const c = work.cells[i];
      let o;
      if (!c) o = L.map((v) => v * 0.55);
      else {
        const bc = hexToRgb(c).map((v) => v / 255);
        o = bc.map((v, k) => v * 0.04 + L[k] * (0.15 + 0.85 * v) * 1.7);
      }
      // 过曝的部分往白色溢出,看起来更像在发光
      const over = Math.max(0, Math.max(o[0], o[1], o[2]) - 1) * 0.45;
      cellBuf[i * 3] = Math.min(1, o[0] + over);
      cellBuf[i * 3 + 1] = Math.min(1, o[1] + over);
      cellBuf[i * 3 + 2] = Math.min(1, o[2] + over);
    }
  }

  // =====================================================================
  // 视图、主题、侧栏、弹窗、开关灯
  // =====================================================================
  let threeTimer = null;
  function setView(view) {
    ui.view = view;
    document.querySelectorAll("[data-view]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === view)));
    $("#stage2d").hidden = view !== "2d";
    $("#stage3d").hidden = view !== "3d";
    const msg = $("#viewMsg");
    msg.hidden = true;
    if (view === "3d") {
      quest.done("view3d");
      if (window.MB3D) { window.MB3D.mount($("#stage3d")); push3d(); }
      else {
        msg.textContent = "3D 预览加载中…";
        msg.hidden = false;
        clearTimeout(threeTimer);
        threeTimer = setTimeout(() => { if (!window.MB3D) msg.textContent = "3D 预览没能加载(需要联网)。展开图照常可用。"; }, 8000);
      }
    }
    updateStatus();
    refreshView();
  }
  document.querySelectorAll("[data-view]").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
  window.addEventListener("mb3d-ready", () => { if (ui.view === "3d") setView("3d"); });

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    if (themeBtn) themeBtn.textContent = t === "dark" ? "浅色" : "深色";
    try { localStorage.setItem("mb.demo.theme", t); } catch { /* 忽略 */ }
    push3d();
    refreshView();
  }
  const themeBtn = $("#themeBtn"); // 精简后页面上没有这个按钮,主题沿用选关页的
  if (themeBtn) {
    themeBtn.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "浅色" : "深色";
  }

  $("#collapse").addEventListener("click", () => { $("#app").classList.toggle("side-off"); requestAnimationFrame(refreshView); });

  const welcome = $("#welcome");
  const closeWelcome = () => { welcome.hidden = true; storage.set("mb.demo.welcomed", 1); };
  $("#welcomeClose").addEventListener("click", closeWelcome);
  $("#welcomeGo").addEventListener("click", closeWelcome);
  welcome.addEventListener("click", (e) => { if (e.target === welcome) closeWelcome(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !welcome.hidden) closeWelcome(); });
  $("#helpBtn").addEventListener("click", () => { welcome.hidden = false; });
  $("#aboutBtn").addEventListener("click", () => { welcome.hidden = false; });

  $("#optGrid").addEventListener("change", (e) => { ui.showGrid = e.target.checked; push3d(); refreshView(); });

  // ---- 开关灯 + 动画循环 ----
  let raf = 0, t0 = performance.now();
  function setLamp(on) {
    light.on = on;
    if (on) quest.done("lightOn");
    const b = $("#lampSwitch");
    b.setAttribute("aria-pressed", String(on));
    b.querySelector("span").textContent = on ? "关灯" : "开灯";
    $("#view").classList.toggle("night", on);
    cancelAnimationFrame(raf);
    if (on) loop(); else { frame(); }
    updateStatus();
  }
  $("#lampSwitch").addEventListener("click", () => setLamp(!light.on));
  function frame() {
    const t = (performance.now() - t0) / 1000;
    if (light.on) computeFrame(t);
    if (ui.view === "2d") drawBoard();
    else if (window.MB3D) window.MB3D.setLight(light.on, cellBuf, ledBuf, work.cells);
  }
  function loop() { frame(); raf = requestAnimationFrame(loop); }

  // ---- 灯光控件 ----
  function syncLightUI() {
    document.querySelectorAll("#effects [data-fx]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fx === light.fx)));
    $("#lightColor").value = light.color;
    $("#lightColorRow").style.opacity = light.fx === "rainbow" ? 0.4 : 1;
    $("#brightness").value = light.bright; $("#brightnessLabel").textContent = light.bright + "%";
    $("#speed").value = light.speed; $("#speedLabel").textContent = light.speed;
    $("#speedRow").style.opacity = light.fx === "solid" ? 0.4 : 1;
  }
  function lightChanged() {
    syncLightUI();
    saveAll();
    if (!light.on) setLamp(true); else frame();
    updateStatus();
  }
  document.querySelectorAll("#effects [data-fx]").forEach((b) => b.addEventListener("click", () => { light.fx = b.dataset.fx; lightChanged(); }));
  document.querySelectorAll("#lightPresets [data-c]").forEach((b) => b.addEventListener("click", () => { light.color = b.dataset.c; lightChanged(); }));
  $("#lightColor").addEventListener("input", (e) => { light.color = e.target.value.toUpperCase(); lightChanged(); });
  $("#brightness").addEventListener("input", (e) => { light.bright = Number(e.target.value); lightChanged(); });
  $("#speed").addEventListener("input", (e) => { light.speed = Number(e.target.value); lightChanged(); });

  // 去留联系方式:把「玩过灯罩、拼了多少、选了什么灯效」带给表单(同源 sessionStorage)
  function recordDemo() {
    const st = stats();
    try { sessionStorage.setItem("mb.demo", JSON.stringify({ lamp: 1, parts: st.parts, colors: st.rows.length, fx: light.fx })); } catch { /* 忽略 */ }
  }
  document.querySelectorAll("[data-go-join]").forEach((a) => a.addEventListener("click", () => {
    recordDemo();
    try { sessionStorage.setItem("mb.cta", JSON.stringify("demo")); } catch { /* 忽略 */ }
  }));

  // =====================================================================
  // 展开图:四面一排(窄屏 2×2),直接在上面画
  // =====================================================================
  const board = $("#board");
  const ctx = board.getContext("2d");
  let lay = null; // { cell, faces: [{x, y}], w, h, dpr }

  function layout() {
    const st = $("#stage2d"), dpr = window.devicePixelRatio || 1;
    const W = Math.max(200, st.clientWidth - 40), H = Math.max(200, st.clientHeight - 110);
    const label = 22;
    // 一排:4N 格 + 3 个间隔(0.9 格);2×2:2N 格 + 1 个间隔
    const rowCell = Math.min(W / (4 * N + 3 * 0.9), (H - label) / N);
    const gridCell = Math.min(W / (2 * N + 0.9), (H - 2 * label - 0.9 * 1) / (2 * N + 0.9));
    const two = gridCell > rowCell * 1.15;
    const cell = Math.floor((two ? gridCell : rowCell) * 4) / 4;
    const gap = cell * 0.9;
    const faces = [];
    for (let f = 0; f < F; f++) {
      const col = two ? f % 2 : f, row = two ? (f / 2) | 0 : 0;
      faces.push({ x: col * (N * cell + gap), y: label + row * (N * cell + gap + label) });
    }
    const w = two ? 2 * N * cell + gap : 4 * N * cell + 3 * gap;
    const h = two ? 2 * (N * cell + label) + gap : N * cell + label;
    board.style.width = w + "px"; board.style.height = h + "px";
    board.width = Math.round(w * dpr); board.height = Math.round(h * dpr);
    lay = { cell, faces, w, h, dpr };
  }

  function drawBoard() {
    if (!lay) return;
    const { cell, faces, dpr } = lay;
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, lay.w, lay.h);
    const night = light.on;
    const dot = css("--dot"), boardBg = css("--board"), text2 = css("--text-2");
    g.font = `600 12px ${css("--font")}`;
    for (let f = 0; f < F; f++) {
      const { x: fx, y: fy } = faces[f], S = N * cell;
      g.fillStyle = f === work.face ? css("--accent") : text2;
      g.fillText(FACE_NAMES[f] + (f === work.face ? " ·" : ""), fx, fy - 7);
      if (night) {
        // 灯板的柔光:8×8 灯珠插值放大,垫在拼豆下面
        const off = document.createElement("canvas");
        off.width = LED; off.height = LED;
        const og = off.getContext("2d"), img = og.createImageData(LED, LED);
        for (let i = 0; i < LED * LED; i++) {
          const j = (f * LED * LED + i) * 3;
          img.data[i * 4] = ledBuf[j] * 200; img.data[i * 4 + 1] = ledBuf[j + 1] * 200; img.data[i * 4 + 2] = ledBuf[j + 2] * 200; img.data[i * 4 + 3] = 255;
        }
        og.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = true;
        g.drawImage(off, fx, fy, S, S);
      } else {
        g.fillStyle = boardBg;
        g.fillRect(fx, fy, S, S);
      }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = f * N * N + y * N + x, c = work.cells[i];
        const cx = fx + x * cell + cell / 2, cy = fy + y * cell + cell / 2;
        if (night) {
          g.fillStyle = toCss(cellBuf[i * 3], cellBuf[i * 3 + 1], cellBuf[i * 3 + 2]);
          g.beginPath(); g.arc(cx, cy, c ? cell * 0.46 : cell * 0.3, 0, Math.PI * 2); g.fill();
          if (c) { g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.arc(cx, cy, cell * 0.17, 0, Math.PI * 2); g.fill(); }
          continue;
        }
        if (!c) {
          g.fillStyle = dot;
          g.beginPath(); g.arc(cx, cy, Math.max(1, cell * 0.08), 0, Math.PI * 2); g.fill();
          continue;
        }
        g.fillStyle = c;
        g.beginPath(); g.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); g.fill();
        g.strokeStyle = isLight(c) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.16)";
        g.lineWidth = Math.max(1, cell * 0.04); g.stroke();
        g.fillStyle = isLight(c) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.22)";
        g.beginPath(); g.arc(cx, cy, cell * 0.17, 0, Math.PI * 2); g.fill();
      }
      if (ui.showGrid && !night) { // 每 2 格 = 一颗灯珠,画 4 格一条线方便数
        g.strokeStyle = css("--grid"); g.lineWidth = 1;
        for (let k = 4; k < N; k += 4) {
          g.beginPath(); g.moveTo(fx + k * cell, fy); g.lineTo(fx + k * cell, fy + S); g.stroke();
          g.beginPath(); g.moveTo(fx, fy + k * cell); g.lineTo(fx + S, fy + k * cell); g.stroke();
        }
      }
      g.strokeStyle = f === work.face ? css("--accent") : css("--line");
      g.lineWidth = f === work.face ? 2 : 1;
      g.strokeRect(fx - 0.5, fy - 0.5, S + 1, S + 1);
    }
  }

  function cellAt(ev) {
    const r = board.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    for (let f = 0; f < F; f++) {
      const { x, y } = lay.faces[f], S = N * lay.cell;
      if (px >= x && px < x + S && py >= y && py < y + S) {
        return f * N * N + Math.floor((py - y) / lay.cell) * N + Math.floor((px - x) / lay.cell);
      }
    }
    return -1;
  }

  // ---- 调色板、工具 ----
  function renderPalette() {
    const box = $("#palette");
    box.innerHTML = "";
    for (const c of work.palette) {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = c;
      b.title = c;
      b.setAttribute("aria-label", "颜色 " + c);
      b.setAttribute("aria-pressed", String(c === work.color));
      b.addEventListener("click", () => { work.color = c; if (work.tool === "erase" || work.tool === "pick") setTool("pen"); renderPalette(); });
      box.appendChild(b);
    }
  }
  function setTool(t) {
    work.tool = t;
    document.querySelectorAll("#tools [data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
  }
  document.querySelectorAll("#tools [data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  function addToPalette(c) {
    c = c.toUpperCase();
    if (!work.palette.includes(c)) work.palette.push(c);
    work.color = c;
    renderPalette();
  }
  $("#addColor").addEventListener("click", () => { addToPalette($("#customColor").value); setTool("pen"); commit(); });

  function flood(i, to) {
    const from = work.cells[i];
    if (from === to) return;
    const base = ((i / (N * N)) | 0) * N * N, stack = [i - base];
    while (stack.length) {
      const k = stack.pop();
      if (work.cells[base + k] !== from) continue;
      work.cells[base + k] = to;
      const x = k % N, y = (k / N) | 0;
      if (x > 0) stack.push(k - 1);
      if (x < N - 1) stack.push(k + 1);
      if (y > 0) stack.push(k - N);
      if (y < N - 1) stack.push(k + N);
    }
  }
  function applyAt(i) {
    if (i < 0) return;
    work.face = (i / (N * N)) | 0;
    if (work.tool === "pen") work.cells[i] = work.color;
    else if (work.tool === "erase") work.cells[i] = null;
    else if (work.tool === "fill") flood(i, work.color);
    else if (work.tool === "pick" && work.cells[i]) { addToPalette(work.cells[i]); setTool("pen"); }
  }

  let painting = false, lastCell = -1;
  board.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || !lay) return;
    ev.preventDefault();
    board.setPointerCapture(ev.pointerId);
    painting = work.tool === "pen" || work.tool === "erase";
    lastCell = cellAt(ev);
    applyAt(lastCell);
    update();
    if (!painting) commit();
  });
  board.addEventListener("pointermove", (ev) => {
    if (!painting) return;
    const i = cellAt(ev);
    if (i === lastCell) return;
    lastCell = i;
    applyAt(i);
    update();
  });
  const stop = () => { if (painting) commit(); painting = false; lastCell = -1; };
  board.addEventListener("pointerup", stop);
  board.addEventListener("pointercancel", stop);

  $("#copyFace").addEventListener("click", () => {
    const src = work.cells.slice(work.face * N * N, (work.face + 1) * N * N);
    for (let f = 0; f < F; f++) for (let k = 0; k < N * N; k++) work.cells[f * N * N + k] = src[k];
    commit();
    update();
  });

  // ---- 模板 ----
  function rnd(seed) { let s = seed; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
  const TEMPLATES = {
    stars() {
      const bg = "#1B2A4A", star = "#F5D547", white = "#FFFFFF", moon = "#F6E7DA";
      const c = new Array(CELLS).fill(bg), r = rnd(7);
      for (let f = 0; f < F; f++) for (let s = 0; s < 11; s++) {
        const x = 1 + ((r() * 14) | 0), y = 1 + ((r() * 14) | 0);
        c[f * N * N + y * N + x] = r() < 0.6 ? star : white;
      }
      for (let y = 2; y <= 7; y++) for (let x = 8; x <= 13; x++) {
        const d = Math.hypot(x - 10.5, y - 4.5), d2 = Math.hypot(x - 12, y - 3.6);
        if (d < 2.9 && d2 > 2.2) c[y * N + x] = moon;
      }
      return [c, [bg, star, white, moon]];
    },
    stripes() {
      const cols = ["#E5484D", "#F28B2E", "#F5D547", "#3DB86B", "#1F8FA6", "#3E63DD", "#8E4EC6", "#F2A7C3"];
      const c = new Array(CELLS);
      for (let f = 0; f < F; f++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) c[f * N * N + y * N + x] = cols[((f * N + x) >> 3) % cols.length];
      return [c, cols];
    },
    hearts() {
      const bg = "#F6E7DA", red = "#E5484D", ink = "#16181D";
      const HEART = [
        "..XXX..XXX..",
        ".XRRRXXRRRX.",
        "XRRRRRRRRRRX",
        "XRRRRRRRRRRX",
        "XRRRRRRRRRRX",
        ".XRRRRRRRRX.",
        "..XRRRRRRX..",
        "...XRRRRX...",
        "....XRRX....",
        ".....XX.....",
      ];
      const c = new Array(CELLS).fill(bg);
      for (let f = 0; f < F; f++) HEART.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch !== ".") c[f * N * N + (j + 3) * N + (i + 2)] = ch === "X" ? ink : red;
      }));
      return [c, [bg, red, ink]];
    },
    window() {
      const wood = "#5B3A29", dark = "#3B2418", glass = "#F5D547", frame = "#16181D", roof = "#8B5A3C";
      const c = new Array(CELLS);
      for (let f = 0; f < F; f++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let v = y < 3 ? roof : (y % 3 === 2 ? dark : wood);
        const wx = f === 0 ? [2, 7] : [5, 10], wy = [5, 10];
        if (x >= wx[0] && x <= wx[1] && y >= wy[0] && y <= wy[1]) {
          const mid = (wx[0] + wx[1]) / 2, midy = (wy[0] + wy[1]) / 2;
          v = (x === wx[0] || x === wx[1] || y === wy[0] || y === wy[1] || Math.abs(x - mid) < 0.6 || Math.abs(y - midy) < 0.6) ? frame : glass;
        }
        if (f === 0 && x >= 10 && x <= 13 && y >= 8) v = x === 10 || x === 13 || y === 8 ? frame : dark;
        if (f === 0 && x === 12 && y === 12) v = glass;
        c[f * N * N + y * N + x] = v;
      }
      return [c, [wood, dark, glass, frame, roof]];
    },
  };
  document.querySelectorAll("#templates [data-tpl]").forEach((b) => b.addEventListener("click", () => {
    quest.done("template");
    const [cells, cols] = TEMPLATES[b.dataset.tpl]();
    work.cells = cells;
    cols.forEach((c) => { if (!work.palette.includes(c)) work.palette.push(c); });
    commit();
    renderPalette();
    update();
  }));

  // ---- 图片铺满四面:裁成 4:1,缩到 64×16,k-means 收成几种颜色 ----
  const colorCount = $("#colorCount");
  colorCount.addEventListener("input", () => { $("#colorCountLabel").textContent = colorCount.value; });
  $("#importImage").addEventListener("click", () => $("#imageInput").click());
  $("#imageInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => { importImage(img, Number(colorCount.value)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  });
  function importImage(img, k) {
    const W = F * N, H = N, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    let sw = img.width, sh = img.width / 4;
    if (sh > img.height) { sh = img.height; sw = sh * 4; }
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const px = [];
    for (let i = 0; i < W * H; i++) px.push(d[i * 4 + 3] < 128 ? null : [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    const pts = px.filter(Boolean);
    if (!pts.length) return;
    const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    const centers = [pts[(pts.length / 2) | 0].slice()];
    while (centers.length < Math.min(k, pts.length)) {
      let best = null, bd = -1;
      for (const p of pts) {
        const dmin = Math.min(...centers.map((q) => dist2(p, q)));
        if (dmin > bd) { bd = dmin; best = p; }
      }
      if (bd <= 0) break;
      centers.push(best.slice());
    }
    const nearest = (p) => { let bi = 0, bd = Infinity; centers.forEach((q, i) => { const dd = dist2(p, q); if (dd < bd) { bd = dd; bi = i; } }); return bi; };
    for (let it = 0; it < 12; it++) {
      const sum = centers.map(() => [0, 0, 0, 0]);
      for (const p of pts) { const s4 = sum[nearest(p)]; s4[0] += p[0]; s4[1] += p[1]; s4[2] += p[2]; s4[3]++; }
      sum.forEach((s4, i) => { if (s4[3]) centers[i] = [s4[0] / s4[3], s4[1] / s4[3], s4[2] / s4[3]]; });
    }
    const hexes = centers.map((q) => rgbToHex(q[0], q[1], q[2]));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = px[y * W + x], f = (x / N) | 0;
      work.cells[f * N * N + y * N + (x % N)] = p ? hexes[nearest(p)] : null;
    }
    hexes.forEach((h) => { if (!work.palette.includes(h)) work.palette.push(h); });
    commit();
    renderPalette();
    update();
  }

  // ---- 统计 ----
  function stats() {
    const counts = new Map();
    for (const c of work.cells) if (c) counts.set(c, (counts.get(c) || 0) + 1);
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color, count]) => ({ color, count }));
    return { rows, parts: rows.reduce((s, r) => s + r.count, 0) };
  }

  function saveAll() {
    storage.set("mb.demo.lamp", { cells: work.cells, palette: work.palette, light: { fx: light.fx, color: light.color, bright: light.bright, speed: light.speed } });
  }

  function update() {
    push3d();
    refreshView();
    const st = stats();
    $("#sumParts").textContent = st.parts;
    $("#sumColors").textContent = st.rows.length;
    const bom = $("#bom");
    bom.innerHTML = st.rows.length ? "" : '<tr><td colspan="2" style="color:var(--text-2)">还空着,先挑个模板吧</td></tr>';
    for (const r of st.rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><span class="dot" style="background:${r.color}"></span><span style="font-family:var(--mono)">${r.color}</span></td><td class="num">${r.count}</td>`;
      bom.appendChild(tr);
    }
    $("#activeFaceName").textContent = FACE_NAMES[work.face];
    saveAll();
    if (st.parts) recordDemo();
    updateStatus(st);
    syncHistoryButtons();
  }

  // =====================================================================
  // 导出:图纸 PNG、ESP32 代码
  // =====================================================================
  $("#dlPng").addEventListener("click", () => {
    const st = stats(), cell = 20, gap = 28, pad = 28, S = N * cell;
    const W = pad * 2 + 4 * S + 3 * gap;
    const rows = Math.ceil(st.rows.length / 3);
    const out = document.createElement("canvas");
    out.width = W; out.height = pad + 60 + S + 40 + rows * 28 + 50;
    const g = out.getContext("2d");
    g.fillStyle = "#FBFBF8"; g.fillRect(0, 0, out.width, out.height);
    g.fillStyle = "#16181D"; g.font = "bold 22px sans-serif";
    g.fillText("拼豆灯罩图纸 · 四面各 16 × 16", pad, pad + 20);
    g.font = "14px sans-serif"; g.fillStyle = "#6B7079";
    g.fillText(`共 ${st.parts} 颗 · ${st.rows.length} 种颜色 · 灯效:${FX_NAMES[light.fx]} · 每面背后一块 8×8 灯板(1 颗灯珠对 2×2 颗拼豆)`, pad, pad + 46);
    const top = pad + 70;
    for (let f = 0; f < F; f++) {
      const fx = pad + f * (S + gap);
      g.fillStyle = "#16181D"; g.font = "bold 14px sans-serif";
      g.fillText(FACE_NAMES[f], fx, top - 8);
      g.strokeStyle = "#D5D5CE"; g.strokeRect(fx - 0.5, top - 0.5, S + 1, S + 1);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const c = work.cells[f * N * N + y * N + x], cx = fx + x * cell + cell / 2, cy = top + y * cell + cell / 2;
        g.fillStyle = c || "#E2E2DB";
        g.beginPath(); g.arc(cx, cy, c ? cell * 0.46 : 1.5, 0, Math.PI * 2); g.fill();
        if (c) { g.fillStyle = isLight(c) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.22)"; g.beginPath(); g.arc(cx, cy, cell * 0.16, 0, Math.PI * 2); g.fill(); }
      }
    }
    g.font = "14px monospace";
    st.rows.forEach((r, i) => {
      const x = pad + (i % 3) * 260, y = top + S + 36 + ((i / 3) | 0) * 28;
      g.fillStyle = r.color; g.beginPath(); g.arc(x + 9, y - 5, 9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(0,0,0,.2)"; g.stroke();
      g.fillStyle = "#16181D"; g.fillText(`${r.color}  ×${r.count}`, x + 26, y);
    });
    g.fillStyle = "#9CA1AA"; g.font = "12px sans-serif";
    g.fillText("由 MatterBench 在线体验生成", pad, out.height - 20);
    out.toBlob((b) => b && download("拼豆灯罩图纸.png", b));
  });

  function buildSketch() {
    const [r, g, b] = hexToRgb(light.color);
    const hx = (v) => "0x" + v.toString(16).toUpperCase().padStart(2, "0");
    return `// 拼豆灯罩灯效 · 由 MatterBench 在线体验生成
// 硬件:ESP32 开发板 + 4 块 8×8 WS2812B 灯板串联(前→右→后→左),5V 3A 电源
// 接线:灯板 DIN → GPIO 5;灯板 5V / GND 接电源,ESP32 的 GND 和电源 GND 连在一起
// 依赖:Arduino IDE 装好 ESP32 板卡支持,库管理器里装 FastLED
// 当前选择:${FX_NAMES[light.fx]} · 颜色 ${light.color} · 亮度 ${light.bright}% · 速度 ${light.speed}

#include <FastLED.h>

#define DATA_PIN    5
#define PANELS      4
#define PANEL_W     8
#define PANEL_H     8
#define NUM_LEDS    (PANELS * PANEL_W * PANEL_H)
#define SERPENTINE  true   // 灯板是蛇形走线就保持 true;每行都从左往右就改成 false

CRGB leds[NUM_LEDS];

const uint8_t EFFECT     = ${FX.indexOf(light.fx)};   // 0 常亮 1 呼吸 2 彩虹环绕 3 流光上升 4 星光闪烁
const CRGB    BASE_COLOR = CRGB(${hx(r)}, ${hx(g)}, ${hx(b)});
const uint8_t BRIGHTNESS = ${Math.round(light.bright * 2.55)};  // 0–255
const float   SPEED      = ${light.speed};     // 1–10

// 第 panel 块灯板上 (x, y) 那颗灯珠在灯带里的序号;y 从上往下
uint16_t XY(uint8_t panel, uint8_t x, uint8_t y) {
  uint16_t i = (SERPENTINE && (y & 1)) ? (y * PANEL_W + (PANEL_W - 1 - x)) : (y * PANEL_W + x);
  return panel * PANEL_W * PANEL_H + i;
}

uint32_t hash32(uint32_t a) {
  a ^= a >> 16; a *= 0x7feb352dUL;
  a ^= a >> 15; a *= 0x846ca68bUL;
  a ^= a >> 16;
  return a;
}

CRGB scaled(const CRGB &c, float k) {
  k = constrain(k, 0.0f, 1.0f);
  return CRGB(c.r * k, c.g * k, c.b * k);
}

CRGB effect(uint8_t p, uint8_t x, uint8_t y, float t) {
  switch (EFFECT) {
    case 1: {  // 呼吸
      float k = 0.2f + 0.8f * (0.5f - 0.5f * cosf(TWO_PI * t * 0.06f * SPEED));
      return scaled(BASE_COLOR, k);
    }
    case 2: {  // 彩虹环绕
      float h = (p * PANEL_W + x) / float(PANELS * PANEL_W) + t * 0.05f * SPEED;
      h -= floorf(h);
      return CRGB(CHSV(uint8_t(h * 255), 255, 255));
    }
    case 3: {  // 流光上升
      float s = 0.5f + 0.5f * sinf(TWO_PI * (y / float(PANEL_H) + t * 0.12f * SPEED));
      return scaled(BASE_COLOR, 0.15f + 0.85f * s * s);
    }
    case 4: {  // 星光闪烁
      uint32_t id = (uint32_t(p) * PANEL_H + y) * PANEL_W + x;
      float s = t * 0.8f * SPEED + (hash32(id) % 1000) / 1000.0f;
      uint32_t step = uint32_t(s);
      float fr = s - step;
      CRGB base = scaled(BASE_COLOR, 0.3f);
      if (hash32(id * 7919UL + step) % 100 >= 12) return base;
      CRGB spark = BASE_COLOR;
      spark += CRGB(60, 60, 60);
      return blend(spark, base, uint8_t(fr * 255));
    }
    default:   // 常亮
      return BASE_COLOR;
  }
}

void setup() {
  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 2500);  // 256 颗灯珠全白很费电,限个流
  FastLED.setBrightness(BRIGHTNESS);
}

void loop() {
  float t = millis() / 1000.0f;
  for (uint8_t p = 0; p < PANELS; p++)
    for (uint8_t y = 0; y < PANEL_H; y++)
      for (uint8_t x = 0; x < PANEL_W; x++)
        leds[XY(p, x, y)] = effect(p, x, y, t);
  FastLED.show();
  delay(16);
}
`;
  }
  $("#dlCode").addEventListener("click", () => {
    download("bead_lamp.ino", new Blob([buildSketch()], { type: "text/plain;charset=utf-8" }));
    quest.done("code");
  });
  window.MB_buildSketch = buildSketch; // 方便调试

  // =====================================================================
  // 视窗、状态栏
  // =====================================================================
  function push3d() {
    if (ui.view !== "3d" || !window.MB3D) return;
    window.MB3D.setLamp({ cells: work.cells, theme: document.documentElement.dataset.theme, grid: ui.showGrid });
    if (!light.on) window.MB3D.setLight(false, cellBuf, ledBuf, work.cells);
  }
  function refreshView() {
    if (ui.view === "2d") layout();
    if (light.on) computeFrame((performance.now() - t0) / 1000);
    frame();
  }
  const hintText = () => ui.view === "3d"
    ? "左键拖:旋转 · 右键拖:平移 · 滚轮:缩放 · L 开关灯"
    : "点一下放一颗 · 按住拖动连续画 · L 开关灯 · Ctrl+Z 撤销";
  function updateStatus(st) {
    st = st || stats();
    $("#statusInfo").textContent = `灯罩 4 面 × 16×16 · ${st.parts} 颗 · ${st.rows.length} 种颜色 · 灯效 ${FX_NAMES[light.fx]}${light.on ? " · 开灯中" : ""}`;
    $("#statusHint").textContent = hintText();
  }

  let resizeRaf = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(refreshView); });

  // ---- 启动:第一次来给一个星空灯罩 ----
  if (!saved) {
    const [cells, cols] = TEMPLATES.stars();
    work.cells = cells;
    cols.forEach((c) => { if (!work.palette.includes(c)) work.palette.push(c); });
    hist.prev = snap();
  }
  setTool("pen");
  renderPalette();
  syncLightUI();
  update();
  setView("2d");
  if (!storage.get("mb.demo.welcomed")) welcome.hidden = false;
})();
