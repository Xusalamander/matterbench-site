// 拼豆伙伴卡的生成与绘制,伙伴主页(demo.html)和查验页(card.html)共用。
// 整张卡只由卡号(一个 32 位种子)决定;领奖码 = 卡号 + 过了哪几关 + 校验位。
(() => {
  "use strict";
  const cfg = window.MB_CONFIG || {};
  const TIERS = cfg.cardTiers && cfg.cardTiers.length ? cfg.cardTiers : [
    { id: "N", name: "普通", weight: 60, prize: "—" }, { id: "R", name: "稀有", weight: 28, prize: "—" },
    { id: "SR", name: "超稀有", weight: 10, prize: "—" }, { id: "SSR", name: "传说", weight: 2, prize: "—" },
  ];
  const LOOK = { // 每档卡框的颜色
    N: { frame: ["#5B606B", "#3A3D45"], tag: "#8C9099" },
    R: { frame: ["#2BB0C9", "#1F6F86"], tag: "#2BB0C9" },
    SR: { frame: ["#B07CFF", "#5B2FA8"], tag: "#B07CFF" },
    SSR: { frame: ["#FFE38A", "#F2A23C"], tag: "#FFD24A" },
  };

  // ---- 卡号:32 位种子 + 1 位校验,32 个不易混的字符 ----
  const ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const hash32 = (x) => { x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); return (x ^ (x >>> 16)) >>> 0; };
  const check = (seed) => hash32(seed ^ 0x6d62_6364) & 31;
  function encode(seed) {
    let s = "";
    for (let i = 6; i >= 0; i--) s += ABC[(seed / 2 ** (i * 5)) & 31];
    s += ABC[check(seed)];
    return "MB-" + s.slice(0, 4) + "-" + s.slice(4);
  }
  function decode(code) {
    const s = String(code || "").toUpperCase().replace(/^MB/, "").replace(/[^0-9A-Z]/g, "");
    if (s.length !== 8) return null;
    let seed = 0;
    for (let i = 0; i < 7; i++) { const v = ABC.indexOf(s[i]); if (v < 0) return null; seed = seed * 32 + v; }
    if (seed > 0xffffffff || ABC.indexOf(s[7]) !== check(seed)) return null;
    return seed;
  }

  // ---- 由种子生成整张卡 ----
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const BODY = ["#E5484D", "#F28B2E", "#F5D547", "#C6F04A", "#3DB86B", "#1F8FA6", "#3E63DD", "#8E4EC6", "#F2A7C3", "#F6E7DA"];
  const INK = "#16181D", PINK = "#FF8FA8", GOLD = "#FFD24A";
  const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  // 半边身体的形状(右边镜像出来):. 空 r 随机 b 一定有
  const HALF = [
    ".......", ".......", "....rrb", "...rbbb", "..rbbbb", "..rbbbb", ".rbbbbb",
    ".rbbbbb", ".rrbbbb", "..rbbbb", "..rbbbb", "...rrrb", "...r...", ".......",
  ];
  const G = 14;
  const ADJ = ["圆滚滚的", "爱发光的", "慢吞吞的", "闪闪的", "好奇的", "熬夜的", "彩色的", "会跳舞的", "爱拼图的", "害羞的", "勇敢的", "迷糊的"];
  const NOUN = ["豆丁", "豆宝", "豆团子", "豆精灵", "豆怪兽", "豆仔", "豆球", "豆小兽"];
  const SKILL = [
    "一眼分得清三种差不多的红色", "拼豆从来不掉豆", "熨烫时间总是刚刚好", "会把剩下的豆子按颜色分好",
    "看一眼就记住整张图案", "在黑暗里也会发一点点光", "能把一根豆条摆成任何姿势", "拼完会自己转一圈",
    "最爱帮朋友找缺的那一颗", "一颗豆也不浪费", "能从一堆豆里闻出新颜色", "睡觉时会排成一条豆条",
  ];

  // 伙伴的技能:前三个对应在线体验的三关,通关就在卡上点亮;声音还没有关卡,只是预告
  const POWERS = [
    { key: "body", icon: "🧩", name: "拼出身体", level: "pixel", href: "pixel.html", how: "第 1 关 · 拼豆像素画" },
    { key: "light", icon: "💡", name: "发光", level: "lamp", href: "lamp.html", how: "第 2 关 · 发光灯罩" },
    { key: "move", icon: "🦾", name: "可动", level: "puppet", href: "puppet.html", how: "第 3 关 · 会动的豆条小人" },
    { key: "sound", icon: "🔊", name: "声音", level: null, href: null, how: "还在路上,原型开放时第一批解锁" },
  ];
  const DREAM = {
    light: ["装上一块小灯板,肚子会跟着心情变色", "想在夜里当一盏会眨眼的小夜灯", "听说装上灯以后,每颗豆都能透出光"],
    move: ["等豆条关节装好,第一件事是跟你挥手", "想用豆条做一双腿,自己走到桌子另一头", "梦想是学会开合跳"],
    sound: ["想学会一边唱歌一边发光", "听到你的声音就会转过头来", "想给每种颜色配一个音符"],
  };

  function makeCard(seed) {
    const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)];
    const total = TIERS.reduce((s, t) => s + Math.max(0, +t.weight || 0), 0) || 1;
    let roll = r() * total, ti = 0;
    for (; ti < TIERS.length - 1; ti++) { roll -= Math.max(0, +TIERS[ti].weight || 0); if (roll < 0) break; }
    const tier = TIERS[ti], lvl = Math.min(ti, 3);

    const body = pick(BODY);
    let accent = pick(BODY); if (accent === body) accent = BODY[(BODY.indexOf(body) + 3) % BODY.length];
    const belly = mix(body, "#FFFFFF", 0.55);
    const cells = Array.from({ length: G }, () => new Array(G).fill(null));
    const set = (y, hx, c) => { cells[y][hx] = c; cells[y][G - 1 - hx] = c; }; // hx:半边里的列,0 在外侧
    for (let y = 0; y < G; y++) for (let x = 0; x < 7; x++) {
      const m = HALF[y][x];
      if (m === "b" || (m === "r" && r() < 0.5)) set(y, x, body);
    }
    // 描边:挨着身体的空格
    const out = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (cells[y][x]) continue;
      if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => cells[y + dy]?.[x + dx] && cells[y + dy][x + dx] !== INK)) out.push([y, x]);
    }
    for (const [y, x] of out) cells[y][x] = INK;
    // 肚子、斑点
    if (r() < 0.6) for (let y = 8; y <= 10; y++) for (let hx = 5; hx <= 6; hx++) set(y, hx, belly);
    const spots = lvl >= 1 ? 2 + Math.floor(r() * 2) : 0;
    for (let k = 0; k < spots; k++) { const y = 6 + Math.floor(r() * 5), hx = 3 + Math.floor(r() * 3); if (cells[y][hx] === body) set(y, hx, accent); }
    // 眼睛、腮红、嘴
    const ey = 4 + Math.floor(r() * 2), ex = 4 + Math.floor(r() * 2);
    set(ey, ex, "#FFFFFF"); set(ey + 1, ex, INK); // 白眼珠 + 下面一颗黑瞳孔
    if (r() < 0.6 && cells[ey + 2][ex - 1] && cells[ey + 2][ex - 1] !== INK) set(ey + 2, ex - 1, PINK);
    const mouth = pick(["dot", "wide", "open"]);
    if (mouth === "wide") { set(ey + 3, 5, INK); set(ey + 3, 6, INK); }
    else if (mouth === "open") { set(ey + 3, 6, "#C92A3A"); }
    else set(ey + 3, 6, INK);
    // 头顶:超稀有长触角,传说戴王冠
    if (lvl === 2) { set(2, 5, body); set(1, 5, INK); set(0, 4, accent); }
    if (lvl >= 3) { for (let hx = 3; hx <= 6; hx++) { set(2, hx, body); set(1, hx, GOLD); } set(0, 3, GOLD); set(0, 5, GOLD); }

    const stars = () => Math.min(5, 1 + lvl + Math.floor(r() * 3));
    return {
      seed, code: encode(seed), tier, lvl, cells, body, accent,
      name: pick(ADJ) + pick(NOUN),
      stats: [["拼速", stars()], ["配色", stars()], ["脑洞", stars()]],
      skill: pick(SKILL),
      ...(() => { const talent = pick(["light", "move", "sound"]); return { talent, dream: pick(DREAM[talent]) }; })(),
    };
  }

  // ---- 画卡(逻辑尺寸 360×504;k 是缩放,shown 是已经出现的豆子比例) ----
  const FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
  const isLight = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255 > 0.67; };
  function rr(g, x, y, w, h, rad) { g.beginPath(); g.roundRect(x, y, w, h, rad); }
  function frame(g, look) {
    const gr = g.createLinearGradient(0, 0, 360, 504);
    gr.addColorStop(0, look.frame[0]); gr.addColorStop(1, look.frame[1]);
    g.fillStyle = gr; rr(g, 0, 0, 360, 504, 22); g.fill();
    g.fillStyle = "#16181D"; rr(g, 8, 8, 344, 488, 16); g.fill();
  }
  function drawBack(g, k) {
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 360, 504);
    frame(g, { frame: ["#2BB0C9", "#1A1B20"] });
    for (let y = 0; y < 15; y++) for (let x = 0; x < 10; x++) { // 一板淡淡的豆
      g.fillStyle = (x + y) % 3 ? "#23252B" : "#2C2F36";
      g.beginPath(); g.arc(36 + x * 32, 28 + y * 32, 11, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#C6F04A"; g.font = `800 96px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("?", 180, 236);
    g.font = `700 14px ${FONT}`; g.fillStyle = "#E6E7EA"; g.fillText("MatterBench · 拼豆伙伴卡", 180, 330);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
  }
  function wrap(g, text, x, y, maxW, lh) {
    let line = "";
    for (const ch of text) { if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, y); y += lh; line = ch; } else line += ch; }
    if (line) g.fillText(line, x, y);
  }
  // fx:{ body, light, move, t } 已点亮的技能和动画时间(秒)。body 没点亮时,伙伴还只是一张图纸(空心圈)
  function drawCard(g, c, k, shown = 1, nick = "", date = "", fx = {}) {
    const look = LOOK[c.tier.id] || LOOK[["N", "R", "SR", "SSR"][c.lvl]];
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 360, 504);
    frame(g, look);
    // 顶部
    g.fillStyle = "#8C9099"; g.font = `700 11px ${FONT}`; g.fillText("MATTERBENCH · 拼豆伙伴卡", 24, 34);
    g.font = `800 13px ${FONT}`;
    const tw = g.measureText(c.tier.id).width + 20;
    g.fillStyle = look.tag; rr(g, 336 - tw, 19, tw, 22, 11); g.fill();
    g.fillStyle = "#16181D"; g.textAlign = "center"; g.fillText(c.tier.id, 336 - tw / 2, 35); g.textAlign = "left";
    // 画面
    const ax = 24, ay = 50, aw = 312, ah = 270;
    const bg = g.createRadialGradient(180, 185, 10, 180, 185, 190);
    bg.addColorStop(0, c.lvl >= 2 ? mix(look.tag, "#1D1F24", 0.7) : "#262931"); bg.addColorStop(1, "#1D1F24");
    g.fillStyle = bg; rr(g, ax, ay, aw, ah, 12); g.fill();
    const t = fx.t || 0, pulse = 0.7 + 0.3 * Math.sin(t * 2.2);
    if (fx.light) { // 发光:暗下来,身后一团光
      g.fillStyle = "rgba(5,6,8,.72)"; rr(g, ax, ay, aw, ah, 12); g.fill();
      const lg = g.createRadialGradient(180, 190, 10, 180, 190, 150);
      lg.addColorStop(0, mix(c.body, "#1D1F24", 0.35) + "AA"); lg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = pulse; g.fillStyle = lg; g.fillRect(ax, ay, aw, ah); g.globalAlpha = 1;
    }
    if (c.lvl >= 3) { // 传说:闪光
      const r2 = rng(c.seed ^ 0x51a);
      for (let i = 0; i < 18; i++) {
        const x = ax + 14 + r2() * (aw - 28), y = ay + 14 + r2() * (ah - 28), s = 3 + r2() * 5;
        g.fillStyle = `rgba(255,226,140,${0.35 + r2() * 0.5})`;
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.3); g.lineTo(x + s, y); g.lineTo(x + s * 0.3, y + s * 0.3);
        g.lineTo(x, y + s); g.lineTo(x - s * 0.3, y + s * 0.3); g.lineTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 0.3); g.fill();
      }
    }
    const cell = 18, ox = 180 - (G * cell) / 2, oy = ay + (ah - G * cell) / 2;
    const list = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (c.cells[y][x]) list.push([y, x, c.cells[y][x]]);
    const n = Math.round(list.length * shown);
    // 可动:身体上下晃;两侧各装一根 3 颗的豆条当手臂,销子穿过身体边上那颗豆的孔(和第 3 关一样)
    const bob = fx.move ? Math.sin(t * 5) * 2.5 : 0;
    const bead = (cx, cy, col) => {
      if (!fx.body) { // 图纸:空心圈 + 一点底色
        g.globalAlpha = 0.16; g.fillStyle = col; g.beginPath(); g.arc(cx, cy, cell * 0.44, 0, Math.PI * 2); g.fill();
        g.globalAlpha = col === INK ? 0.75 : 0.9; g.strokeStyle = col === INK ? "#8C9099" : col; g.lineWidth = 1.6;
        g.beginPath(); g.arc(cx, cy, cell * 0.38, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
        return;
      }
      if (fx.light && col !== INK) { g.shadowColor = col; g.shadowBlur = 12 * k * pulse; }
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, cell * 0.47, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      if (!isLight(col) && parseInt(col.slice(1, 3), 16) + parseInt(col.slice(3, 5), 16) + parseInt(col.slice(5, 7), 16) < 200) { // 黑豆在深色底上:描一圈亮边
        g.strokeStyle = "rgba(255,255,255,.42)"; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, cell * 0.44, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = isLight(col) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.2)";
      g.beginPath(); g.arc(cx, cy, cell * 0.16, 0, Math.PI * 2); g.fill();
    };
    for (let i = 0; i < n; i++) {
      const [y, x, col] = list[i];
      bead(ox + x * cell + cell / 2, oy + y * cell + cell / 2 + bob, col);
    }
    if (fx.move && shown >= 1) {
      const row = c.cells[7], xl = row.findIndex((v) => v && v !== INK), up = 0.5 + 0.5 * Math.sin(t * 3.2);
      g.save(); rr(g, ax, ay, aw, ah, 12); g.clip();
      for (const side of [-1, 1]) {
        const px = ox + (side < 0 ? xl : G - 1 - xl) * cell + cell / 2, py = oy + 7 * cell + cell / 2 + bob;
        const a = side < 0 ? Math.PI * 0.62 + up * Math.PI * 0.5 : Math.PI * 0.38 - up * Math.PI * 0.5;
        for (let j = 1; j <= 3; j++) bead(px + Math.cos(a) * j * cell, py + Math.sin(a) * j * cell, c.accent);
        g.strokeStyle = "#C6F04A"; g.lineWidth = 2.5; // 销子
        g.beginPath(); g.arc(px, py, cell * 0.22, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    }
    // 左上角:三个未来技能,点亮的是亮的,天赋带一颗星
    POWERS.forEach((p, i) => {
      const on = !!fx[p.key], x = ax + 22, y = ay + 22 + i * 30;
      g.fillStyle = on ? "rgba(198,240,74,.9)" : "rgba(255,255,255,.08)";
      g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
      g.globalAlpha = on ? 1 : 0.6; g.font = `13px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(p.icon, x, y + 1); g.globalAlpha = 1;
      if (p.key === c.talent) { g.fillStyle = "#FFD24A"; g.font = `700 10px ${FONT}`; g.fillText("★", x + 11, y - 9); }
      g.textAlign = "left"; g.textBaseline = "alphabetic";
    });
    // 名字
    g.fillStyle = "#E6E7EA"; g.font = `800 22px ${FONT}`; g.fillText(c.name, 24, 352);
    g.fillStyle = "#8C9099"; g.font = `600 12px ${FONT}`;
    g.fillText(nick ? `${nick}的拼豆伙伴 · ${c.tier.name}` : `拼豆伙伴 · ${c.tier.name}`, 24, 372);
    // 能力
    c.stats.forEach(([label, v], i) => {
      const y = 400 + i * 20;
      g.fillStyle = "#8C9099"; g.font = `600 12px ${FONT}`; g.fillText(label, 24, y);
      for (let s = 0; s < 5; s++) { g.fillStyle = s < v ? look.tag : "#2C2F36"; g.beginPath(); g.arc(70 + s * 16, y - 4, 5.5, 0, Math.PI * 2); g.fill(); }
    });
    g.fillStyle = "#E6E7EA"; g.font = `600 12px ${FONT}`;
    g.fillText("技能", 170, 400);
    g.fillStyle = "#B8BBC2"; wrap(g, c.skill, 170, 420, 166, 18);
    // 底部
    g.strokeStyle = "#2C2F36"; g.lineWidth = 1; g.beginPath(); g.moveTo(24, 456); g.lineTo(336, 456); g.stroke();
    g.fillStyle = "#E6E7EA"; g.font = `700 13px Consolas, "JetBrains Mono", monospace`; g.fillText(c.code, 24, 478);
    g.fillStyle = "#6B7079"; g.font = `500 10px ${FONT}`; g.textAlign = "right";
    g.fillText(date ? `${date} · matterbench.easyfdm.xyz` : "matterbench.easyfdm.xyz", 336, 478); g.textAlign = "left";
  }


  // ---- 领奖码:卡号后面加一位「过了哪几关」(三位的掩码)和一位校验 ----
  const LEVELS = ["pixel", "lamp", "puppet"];
  const maskOf = (passed) => LEVELS.reduce((m, k, i) => m | (passed[k] ? 1 << i : 0), 0);
  const check2 = (seed, mask) => hash32((seed ^ Math.imul(mask + 1, 0x9e3779b1)) >>> 0) & 31;
  const claimCode = (seed, passed) => { const m = maskOf(passed); return encode(seed) + "-" + ABC[m] + ABC[check2(seed, m)]; };
  function decodeAny(code) { // 卡号或领奖码 → { seed, passed | null }
    const s = String(code || "").toUpperCase().replace(/^MB/, "").replace(/[^0-9A-Z]/g, "");
    if (s.length === 8) { const seed = decode(s); return seed === null ? null : { seed, passed: null }; }
    if (s.length !== 10) return null;
    const seed = decode(s.slice(0, 8)), m = ABC.indexOf(s[8]);
    if (seed === null || m < 0 || m > 7 || ABC.indexOf(s[9]) !== check2(seed, m)) return null;
    return { seed, passed: Object.fromEntries(LEVELS.map((k, i) => [k, !!(m & (1 << i))])) };
  }
  // 奖品:抽到的档位起步,每过一关升一档,最多升 cardMaxUpgrade 档,封顶最高档
  function prizeFor(card, passed) {
    const n = LEVELS.filter((k) => passed[k]).length, up = Math.min(n, cfg.cardMaxUpgrade ?? 2);
    const i = Math.min(TIERS.length - 1, TIERS.indexOf(card.tier) + up);
    return { tier: TIERS[i], up, room: Math.min(TIERS.length - 1 - TIERS.indexOf(card.tier), cfg.cardMaxUpgrade ?? 2) - up };
  }
  const fxOf = (passed) => ({ body: !!passed.pixel, light: !!passed.lamp, move: !!passed.puppet });

  window.MBCard = { TIERS, LOOK, POWERS, LEVELS, BODY, makeCard, drawCard, drawBack, encode, claimCode, decodeAny, prizeFor, fxOf };
})();
