// 查验页:贴卡号或领奖码,重新画出同一张卡,并给出档位、闯关记录和该发的奖品。
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const C = window.MBCard;
  const ctx = $("#card").getContext("2d");
  const DPR = Math.min(3, window.devicePixelRatio || 1);
  $("#card").width = 360 * DPR; $("#card").height = 504 * DPR;
  const LEVEL_NAME = { pixel: "第 1 关", lamp: "第 2 关", puppet: "第 3 关" };
  // 图纸上的颜色名;不在这里的(肚皮色是身体色和白色混出来的)按色值写
  const COLOR_NAME = {
    "#E5484D": "红", "#F28B2E": "橙", "#F5D547": "黄", "#C6F04A": "黄绿", "#3DB86B": "绿",
    "#1F8FA6": "青", "#3E63DD": "蓝", "#8E4EC6": "紫", "#F2A7C3": "粉", "#F6E7DA": "米白",
    "#16181D": "黑", "#FFFFFF": "白", "#FF8FA8": "腮红粉", "#FFD24A": "金", "#C92A3A": "深红",
  };
  let cur = null; // 当前查验的 { pet, passed }

  // 每种颜色一个字母,按用量从多到少
  function palette(pet) {
    const count = new Map();
    for (const row of pet.cells) for (const c of row) if (c) count.set(c, (count.get(c) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([hex, n], i) => ({
      hex, n, sym: "ABCDEFGHJKLMNP"[i],
      name: COLOR_NAME[hex.toUpperCase()] || `肚皮色 ${hex}(身体色调浅,挑最接近的豆)`,
    }));
  }
  const ink = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 > 150 ? "#16181D" : "#FFFFFF"; };
  function save(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // 拼豆图纸:14×14 格,行列编号,每格写颜色字母,下面是用料表
  function patternPng() {
    const { pet, passed } = cur, pal = palette(pet), G = pet.cells.length;
    const cell = 48, pad = 56, legendH = 44 + pal.length * 40 + (passed.puppet ? 64 : 0);
    const W = pad * 2 + cell * G, H = 112 + cell * G + pad + legendH;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), F = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#16181D"; g.font = `bold 28px ${F}`; g.textBaseline = "middle";
    g.fillText(`${pet.name} · 拼豆图纸`, pad, 36);
    g.font = `16px ${F}`; g.fillStyle = "#5B606B";
    g.fillText(`${pet.code} · ${pet.tier.name} · ${G}×${G} 格,空格不放豆`, pad, 68);
    const top = 112;
    g.textAlign = "center";
    for (let i = 0; i < G; i++) {
      g.fillStyle = "#9CA1AA"; g.font = `14px ${F}`;
      g.fillText(i + 1, pad + cell * i + cell / 2, top - 14);
      g.fillText(i + 1, pad - 22, top + cell * i + cell / 2);
    }
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const c = pet.cells[y][x], px = pad + x * cell, py = top + y * cell;
      g.strokeStyle = "#E3E5E8"; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, cell, cell);
      if (!c) continue;
      g.fillStyle = c; g.beginPath(); g.arc(px + cell / 2, py + cell / 2, cell * 0.42, 0, Math.PI * 2); g.fill();
      if (c.toUpperCase() === "#FFFFFF") { g.strokeStyle = "#C9CCD1"; g.stroke(); }
      g.fillStyle = ink(c); g.font = `bold 18px ${F}`;
      g.fillText(pal.find((p) => p.hex === c).sym, px + cell / 2, py + cell / 2 + 1);
    }
    // 每 7 格一条粗线,方便数
    g.strokeStyle = "#9CA1AA"; g.lineWidth = 2;
    for (let i = 0; i <= G; i += 7) {
      g.beginPath(); g.moveTo(pad + i * cell, top); g.lineTo(pad + i * cell, top + G * cell); g.stroke();
      g.beginPath(); g.moveTo(pad, top + i * cell); g.lineTo(pad + G * cell, top + i * cell); g.stroke();
    }
    g.textAlign = "left";
    let ly = top + G * cell + pad;
    g.fillStyle = "#16181D"; g.font = `bold 20px ${F}`;
    g.fillText(`用料 · 共 ${pal.reduce((s, p) => s + p.n, 0)} 颗`, pad, ly); ly += 40;
    for (const p of pal) {
      g.fillStyle = p.hex; g.beginPath(); g.arc(pad + 14, ly, 14, 0, Math.PI * 2); g.fill();
      if (p.hex.toUpperCase() === "#FFFFFF") { g.strokeStyle = "#C9CCD1"; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = ink(p.hex); g.font = `bold 15px ${F}`; g.textAlign = "center"; g.fillText(p.sym, pad + 14, ly + 1);
      g.textAlign = "left"; g.fillStyle = "#16181D"; g.font = `17px ${F}`;
      g.fillText(`${p.name.trim()}  × ${p.n}`, pad + 40, ly); ly += 40;
    }
    if (passed.puppet) {
      const row = pet.cells[7], xl = row.findIndex((v) => v && v !== "#16181D");
      g.fillStyle = "#5B606B"; g.font = `16px ${F}`;
      g.fillText(`可动手臂:另做 2 条豆条,每条 3 颗 ${COLOR_NAME[pet.accent] || pet.accent},`, pad, ly + 4);
      g.fillText(`分别装在第 8 行第 ${xl + 1} 格和第 ${G - xl} 格的外侧,能转动。`, pad, ly + 30);
    }
    cv.toBlob((b) => b && save(b, `拼豆图纸-${pet.code}.png`));
  }

  function dataJson() {
    const { pet, passed } = cur, pal = palette(pet), sym = new Map(pal.map((p) => [p.hex, p.sym]));
    const out = {
      code: pet.code, name: pet.name, tier: pet.tier.id, talent: pet.talent,
      levels: C.LEVELS.filter((k) => passed[k]),
      size: pet.cells.length,
      palette: pal.map(({ sym, hex, name, n }) => ({ sym, hex, name: name.trim(), count: n })),
      grid: pet.cells.map((row) => row.map((c) => (c ? sym.get(c) : ".")).join("")),
      arms: passed.puppet ? { beads: 3, color: pet.accent, row: 8 } : null,
    };
    save(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), `拼豆伙伴-${pet.code}.json`);
  }

  function show(code) {
    const res = $("#checkRes"), dl = $("#checkDl");
    res.hidden = false; res.className = "check-res";
    const got = C.decodeAny(code);
    if (!got) {
      C.drawBack(ctx, DPR); dl.hidden = true; $("#checkFiles").hidden = true; cur = null;
      res.textContent = "✗ 号码无效:不是体验页生成的,或者抄错了字。"; res.classList.add("bad");
      return;
    }
    const pet = C.makeCard(got.seed), passed = got.passed || {};
    cur = { pet, passed }; $("#checkFiles").hidden = false;
    // 查验时把伙伴按拼好的样子画(做实物用),发光、可动按闯关记录
    C.drawCard(ctx, pet, DPR, 1, "", "", { ...C.fxOf(passed), body: true, t: Math.PI / 6.4 });
    const pz = C.prizeFor(pet, passed), tal = C.POWERS.find((p) => p.key === pet.talent).name;
    res.textContent = got.passed ? "✓ 领奖码有效" : "✓ 卡号有效(没带闯关记录,按 0 关算)"; res.classList.add("ok");
    const rows = [
      ["伙伴", `${pet.name} · 天赋:${tal}`],
      ["抽到", `${pet.tier.name}(${pet.tier.id})`],
      ["闯关", got.passed ? (C.LEVELS.filter((k) => passed[k]).map((k) => LEVEL_NAME[k]).join("、") || "还没过关") : "—"],
      ["该发", `${pz.tier.name}(${pz.tier.id}):${pz.tier.prize}`],
      ["卡号", pet.code],
    ];
    dl.innerHTML = ""; dl.hidden = false;
    for (const [k, v] of rows) {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      dl.append(dt, dd);
    }
  }

  $("#dlPattern").addEventListener("click", () => cur && patternPng());
  $("#dlData").addEventListener("click", () => cur && dataJson());
  $("#checkForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#codeIn").value.trim();
    history.replaceState(null, "", v ? "?code=" + encodeURIComponent(v) : location.pathname);
    show(v);
  });
  const q = new URLSearchParams(location.search).get("code");
  if (q) { $("#codeIn").value = q; show(q); } else C.drawBack(ctx, DPR);
})();
