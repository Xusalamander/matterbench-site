// 第 1 关:拼豆像素画。16×16 板子,照着淡淡的图案拼。只有画 / 擦 / 撤销。
(() => {
  "use strict";
  const N = 16;
  const FREE_GOAL = 40; // 自由画:放满这么多颗就算拼完一个图案
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
    : isLight(c) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.18)");

  const C = { X: "#16181D", W: "#FFFFFF", F: "#F6E7DA", R: "#E5484D", Y: "#F5D547" };
  const PALETTE = ["#16181D", "#FFFFFF", "#F6E7DA", "#E5484D", "#F28B2E", "#F5D547", "#C6F04A", "#3DB86B", "#1F8FA6", "#3E63DD", "#8E4EC6", "#F2A7C3"];
  const GUIDES = {
    heart: [
      "................", "................", "...XXX....XXX...", "..XRRRX..XRRRX..",
      ".XRRWRRXXRRRRRX.", ".XRWRRRRRRRRRRX.", ".XRRRRRRRRRRRRX.", ".XRRRRRRRRRRRRX.",
      "..XRRRRRRRRRRX..", "...XRRRRRRRRX...", "....XRRRRRRX....", ".....XRRRRX.....",
      "......XRRX......", ".......XX.......", "................", "................",
    ],
    smile: [
      "................", ".....YYYYYY.....", "...YYYYYYYYYY...", "..YYYYYYYYYYYY..",
      ".YYYYYYYYYYYYYY.", ".YYYXXYYYYXXYYY.", "YYYYXXYYYYXXYYYY", "YYYYYYYYYYYYYYYY",
      "YYYYYYYYYYYYYYYY", "YYXYYYYYYYYYYXYY", ".YYXYYYYYYYYXYY.", ".YYYXXYYYYXXYYY.",
      "..YYYYXXXXYYYY..", "...YYYYYYYYYY...", ".....YYYYYY.....", "................",
    ],
    mushroom: [
      "................", ".....XXXXXX.....", "...XXRRRRWWXX...", "..XRRRRRRWWWRX..",
      ".XRWWRRRRRRRRRX.", ".XWWWWRRRRRWWRX.", "XRWWWWRRRRWWWWRX", "XRRWWRRRRRWWWWRX",
      "XRRRRRRRRRRWWRRX", ".XXXXXXXXXXXXXX.", "...XFFFFFFFFX...", "...XFFXFFXFFX...",
      "...XFFXFFXFFX...", "...XFFFFFFFFX...", "....XXXXXXXX....", "................",
    ],
  };
  const guideCells = (name) => {
    const g = GUIDES[name];
    if (!g) return new Array(N * N).fill(null);
    const out = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out.push(C[(g[y] || "")[x]] || null);
    return out;
  };

  // ---- 状态 ----
  const saved = storage.get("mb.demo.pixel");
  const st = {
    guide: saved?.guide && (GUIDES[saved.guide] || saved.guide === "none") ? saved.guide : "heart",
    cells: Array.isArray(saved?.cells) && saved.cells.length === N * N ? saved.cells : new Array(N * N).fill(null),
    color: "#E5484D",
    erase: false,
  };
  let guide = guideCells(st.guide);
  const history = [];
  const pushHistory = () => { history.push(st.cells.slice()); if (history.length > 80) history.shift(); };

  const quest = MBQuest.init({
    level: "pixel",
    tasks: [
      { id: "first", label: "放下第一颗豆" },
      { id: "colors", label: "用上 3 种颜色" },
      { id: "finish", label: `拼完一个图案(照着拼,或自由画满 ${FREE_GOAL} 颗)` },
      { id: "save", label: "下载你的图案" },
    ],
  });

  // ---- 画板 ----
  const board = $("#board"), ctx = board.getContext("2d");
  let cssSide = 0;
  function size() {
    const s = $("#stage2d"), dpr = window.devicePixelRatio || 1;
    cssSide = Math.max(200, Math.floor(Math.min(s.clientWidth - 40, s.clientHeight - 40)));
    board.style.width = board.style.height = cssSide + "px";
    board.width = board.height = Math.round(cssSide * dpr);
  }
  function draw() {
    const W = board.width, cell = W / N;
    const bg = css("--board");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, c = st.cells[i], g = guide[i];
      const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      if (!c) {
        if (g) { // 要拼的位置:淡淡的颜色
          ctx.globalAlpha = 0.28; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          if (Math.abs(lum(g) - lum(bg)) < 0.22) { // 和底色太像的(黑、白):补一圈虚线
            ctx.strokeStyle = rim(g, bg); ctx.lineWidth = Math.max(1, cell * 0.04); ctx.setLineDash([cell * 0.12, cell * 0.1]);
            ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        ctx.fillStyle = css("--dot");
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.2, cell * 0.07), 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rim(c, bg);
      ctx.lineWidth = Math.max(1, cell * 0.04); ctx.stroke();
      ctx.fillStyle = isLight(c) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.22)";
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.17, 0, Math.PI * 2); ctx.fill();
      if (g && g !== c) { // 颜色放错了:小红点提醒
        ctx.fillStyle = "#FF5A5F";
        ctx.beginPath(); ctx.arc(x * cell + cell * 0.82, y * cell + cell * 0.18, cell * 0.1, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function cellAt(ev) {
    const r = board.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * N), y = Math.floor((ev.clientY - r.top) / r.height * N);
    return x < 0 || y < 0 || x >= N || y >= N ? -1 : y * N + x;
  }
  let painting = false, last = -1;
  function apply(i) { if (i >= 0) st.cells[i] = st.erase ? null : st.color; }
  board.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); board.setPointerCapture(e.pointerId);
    pushHistory(); painting = true; last = cellAt(e); apply(last); update();
  });
  board.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const i = cellAt(e); if (i === last) return;
    last = i; apply(i); update();
  });
  const stop = () => { painting = false; last = -1; };
  board.addEventListener("pointerup", stop);
  board.addEventListener("pointercancel", stop);

  // ---- 控件 ----
  function renderPalette() {
    const box = $("#palette"); box.innerHTML = "";
    for (const c of PALETTE) {
      const b = document.createElement("button");
      b.className = "swatch"; b.style.background = c; b.title = c;
      b.setAttribute("aria-label", "颜色 " + c);
      b.setAttribute("aria-pressed", String(!st.erase && c === st.color));
      b.addEventListener("click", () => { st.color = c; setErase(false); });
      box.appendChild(b);
    }
  }
  function setErase(on) {
    st.erase = on;
    $("#modeDraw").setAttribute("aria-pressed", String(!on));
    $("#modeErase").setAttribute("aria-pressed", String(on));
    renderPalette();
  }
  $("#modeDraw").addEventListener("click", () => setErase(false));
  $("#modeErase").addEventListener("click", () => setErase(true));
  function undo() { const h = history.pop(); if (h) { st.cells = h; update(); } }
  $("#undo").addEventListener("click", undo);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  });
  document.querySelectorAll("#guides [data-guide]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.guide === st.guide) return;
    pushHistory();
    st.guide = b.dataset.guide; guide = guideCells(st.guide);
    st.cells = new Array(N * N).fill(null); // 换图案就换一块新板子(可撤销)
    document.querySelectorAll("#guides [data-guide]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    update();
  }));

  $("#dlPng").addEventListener("click", () => {
    const cell = 32, pad = 24, W = N * cell + pad * 2;
    const out = document.createElement("canvas"); out.width = W; out.height = W + 30;
    const g = out.getContext("2d");
    g.fillStyle = "#FBFBF8"; g.fillRect(0, 0, out.width, out.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = st.cells[y * N + x], cx = pad + x * cell + cell / 2, cy = pad + y * cell + cell / 2;
      g.fillStyle = c || "#E2E2DB";
      g.beginPath(); g.arc(cx, cy, c ? cell * 0.46 : 2, 0, Math.PI * 2); g.fill();
      if (c) { g.fillStyle = isLight(c) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.22)"; g.beginPath(); g.arc(cx, cy, cell * 0.17, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = "#9CA1AA"; g.font = "12px sans-serif";
    g.fillText("由 MatterBench 在线体验生成", pad, W + 14);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "拼豆像素画.png";
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      quest.done("save");
    });
  });

  function update() {
    draw();
    const used = new Set(st.cells.filter(Boolean));
    const parts = st.cells.filter(Boolean).length;
    $("#sumParts").textContent = parts;
    $("#sumColors").textContent = used.size;
    const target = guide.filter(Boolean).length;
    const right = guide.reduce((n, g, i) => n + (g && st.cells[i] === g ? 1 : 0), 0);
    $("#statusInfo").textContent = target
      ? `照着拼:已对 ${right} / ${target} 颗` + (right >= target ? " · 完成!" : "")
      : `自由画 · ${parts} 颗 · ${used.size} 种颜色` + (parts >= FREE_GOAL ? " · 完成!" : ` · 再放 ${FREE_GOAL - parts} 颗就算拼完`);
    if (parts) quest.done("first");
    if (used.size >= 3) quest.done("colors");
    if (target ? right / target >= 0.9 : parts >= FREE_GOAL) quest.done("finish");
    storage.set("mb.demo.pixel", { guide: st.guide, cells: st.cells });
  }

  document.querySelectorAll("#guides [data-guide]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.guide === st.guide)));
  window.addEventListener("resize", () => { size(); draw(); });
  renderPalette();
  size();
  update();
})();
