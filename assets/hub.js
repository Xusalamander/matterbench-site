// 在线体验的主页:先领养一只拼豆伙伴,再带它闯三关点亮技能,最后一个出口「领奖并报名」。
// 关卡页过关后会带着 ?up=关卡名 回到这里,播一段升级动画。
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const cfg = window.MB_CONFIG || {};
  const C = window.MBCard;
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 私密窗口等 */ } },
  };
  const ss = { set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* 忽略 */ } } };
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const LEVEL_NAME = { pixel: "第 1 关 · 拼豆像素画", lamp: "第 2 关 · 发光灯罩", puppet: "第 3 关 · 会动的豆条小人" };

  const canvas = $("#card"), wrapEl = $("#cardWrap"), ctx = canvas.getContext("2d");
  const DPR = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = 360 * DPR; canvas.height = 504 * DPR;
  const today = () => { const d = new Date(); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };

  // 四档稀有度、活动说明
  const total = C.TIERS.reduce((s, t) => s + Math.max(0, +t.weight || 0), 0) || 1;
  C.TIERS.forEach((t) => {
    const li = document.createElement("li");
    const tag = document.createElement("span"); tag.className = "tier-tag"; tag.textContent = t.id;
    tag.style.background = (C.LOOK[t.id] || C.LOOK.N).tag;
    const b = document.createElement("b"); b.textContent = `${t.name} ${Math.round((+t.weight || 0) / total * 1000) / 10}%`;
    const p = document.createElement("span"); p.className = "odds-prize"; p.textContent = t.prize;
    li.append(tag, b, p); $("#odds").appendChild(li);
  });
  const up = cfg.cardMaxUpgrade ?? 2;
  [...(cfg.cardRules || []), `抽到的档位是起点,每过一关奖品升一档,最多升 ${up} 档。`].forEach((t) => {
    const li = document.createElement("li"); li.textContent = t; $("#rules").appendChild(li);
  });

  // ---- 状态 ----
  let passed = (window.MBQuest && MBQuest.levels()) || {};
  let pet = null, nick = "", date = "";
  const fx = { body: false, light: false, move: false, t: 0 };
  const paint = (shown = 1) => pet && C.drawCard(ctx, pet, DPR, shown, nick, date, fx);

  let loopOn = false;
  function loop() {
    if (loopOn) return;
    loopOn = true;
    const t0 = performance.now();
    const tick = (now) => {
      fx.t = (now - t0) / 1000;
      if (fx.light || fx.move) paint();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function renderLevels() {
    document.querySelectorAll("[data-level]").forEach((a) => {
      const old = a.querySelector(".level-done"); if (old) old.remove();
      if (!passed[a.dataset.level]) return;
      const tag = document.createElement("span");
      tag.className = "level-done"; tag.textContent = "✓ 已过关";
      a.querySelector(".level-pic").appendChild(tag);
    });
  }

  function renderMine() {
    Object.assign(fx, C.fxOf(passed));
    const look = C.LOOK[pet.tier.id] || C.LOOK.N;
    $("#adopt").hidden = true; $("#mine").hidden = false;
    $("#tierTag").textContent = pet.tier.id; $("#tierTag").style.background = look.tag;
    $("#tierName").textContent = pet.tier.name;
    $("#petName").textContent = pet.name;
    $("#dream").textContent = `它的梦想:「${pet.dream}」`;

    // 技能:点亮的打勾,没点亮的写去哪一关
    const box = $("#powers"); box.innerHTML = "";
    for (const p of C.POWERS) {
      const on = !!(p.level && passed[p.level]);
      const row = document.createElement(p.href && !on ? "a" : "div");
      row.className = "power" + (on ? " is-on" : "") + (p.key === pet.talent ? " is-talent" : "") + (p.href ? "" : " is-soon");
      if (p.href && !on) row.href = p.href;
      const ic = document.createElement("span"); ic.className = "power-ic"; ic.textContent = p.icon;
      const txt = document.createElement("div");
      const b = document.createElement("b"); b.textContent = p.name + (p.key === pet.talent ? " · 天赋" : "");
      const sm = document.createElement("small"); sm.textContent = on ? "已学会" : p.how;
      txt.append(b, sm);
      const st = document.createElement("span"); st.className = "power-st";
      st.textContent = on ? "✓" : p.href ? "去学 →" : "即将开放";
      row.append(ic, txt, st); box.appendChild(row);
    }

    // 奖品
    const pz = C.prizeFor(pet, passed);
    $("#prizeText").textContent = `${pz.tier.name}(${pz.tier.id}):${pz.tier.prize}`;
    const nextTier = C.TIERS[C.TIERS.indexOf(pz.tier) + 1];
    $("#prizeWhy").textContent = (pz.up ? `抽到${pet.tier.name},闯关升了 ${pz.up} 档。` : `抽到${pet.tier.name}。`)
      + (pz.room > 0 && nextTier ? `再过一关升到${nextTier.name}:${nextTier.prize}` : "");

    // 下一步:还有没过的关,主按钮就是它;全过了,主按钮变成领奖
    const todo = C.LEVELS.find((k) => !passed[k]);
    const next = $("#nextBtn"), claim = $("#claimBtn");
    if (todo) {
      next.hidden = false; next.href = todo + ".html";
      next.textContent = `下一步:${LEVEL_NAME[todo]} →`;
      claim.className = "btn-claim";
    } else {
      next.hidden = true;
      claim.className = "btn-big";
    }
    const code = C.claimCode(pet.seed, passed);
    $("#codeText").textContent = code;
    ss.set("mb.cta", "lucky-" + pz.tier.id.toLowerCase());
    ss.set("mb.term", code);
    renderLevels();
  }

  function burst(lvl) {
    const box = $("#burst"); box.innerHTML = "";
    wrapEl.classList.remove("glow-1", "glow-2", "glow-3");
    if (lvl) wrapEl.classList.add("glow-" + lvl);
    const n = [12, 18, 30, 48][lvl];
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i");
      const a = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 160;
      d.style.setProperty("--dx", Math.cos(a) * dist + "px"); d.style.setProperty("--dy", Math.sin(a) * dist + "px");
      d.style.background = C.BODY[i % C.BODY.length]; d.style.animationDelay = Math.random() * 0.15 + "s";
      box.appendChild(d);
    }
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
  }

  // ---- 领养 ----
  async function adopt() {
    $("#drawBtn").disabled = true;
    nick = $("#nick").value.trim().slice(0, 8);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    date = today();
    ls.set("mb.card", { seed, nick, date });
    pet = C.makeCard(seed);
    Object.assign(fx, C.fxOf(passed));
    wrapEl.classList.add("shake"); await sleep(700); wrapEl.classList.remove("shake");
    wrapEl.classList.add("flip-out"); await sleep(220);
    paint(0);
    wrapEl.classList.remove("flip-out");
    const t0 = performance.now(), dur = 900;
    await new Promise((res) => {
      const step = (t) => { const p = Math.min(1, (t - t0) / dur); paint(p); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
      setTimeout(res, dur + 400); // 标签页在后台时 rAF 不跑
    });
    paint();
    burst(pet.lvl);
    renderMine();
    loop();
    const n = C.LEVELS.filter((k) => passed[k]).length;
    toast(n ? `领养成功!你之前闯过的 ${n} 关,技能已经教给它了。` : `领养成功!带它去${LEVEL_NAME.pixel},把它拼出来。`);
  }
  $("#drawBtn").addEventListener("click", adopt);
  $("#nick").addEventListener("keydown", (e) => { if (e.key === "Enter") adopt(); });

  // ---- 复制领奖码、分享 ----
  async function copyCode(from) {
    if (!pet) return;
    const code = C.claimCode(pet.seed, passed);
    let ok = false;
    try { await navigator.clipboard.writeText(code); ok = true; } catch { /* 没权限 */ }
    if (!ok) { // 退一步:选中那串码,让他长按 / Ctrl+C
      const r = document.createRange(); r.selectNodeContents($("#codeText"));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { ok = document.execCommand("copy"); } catch { /* 忽略 */ }
    }
    const btn = $("#copyBtn");
    btn.textContent = ok ? "已复制 ✓" : "请手动复制"; btn.classList.toggle("is-ok", ok);
    clearTimeout(copyCode.t); copyCode.t = setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("is-ok"); }, 2500);
    toast(ok
      ? `领奖码 ${code} 已复制` + (from === "claim" ? ",到报名表的「伙伴卡号」一栏粘贴。" : "。")
      : "没能自动复制:领奖码已经选中,长按或 Ctrl+C 复制。");
  }
  $("#copyBtn").addEventListener("click", () => copyCode("copy"));
  $("#claimBtn").addEventListener("click", () => copyCode("claim"));

  // 分享图:卡片 + 二维码。二维码指向在线体验,朋友扫了就能领养自己的
  const SHARE_URL = "https://matterbench.easyfdm.xyz/demo?utm_source=card";
  function shareImage() {
    const W = 1080, H = 1720, out = document.createElement("canvas"); out.width = W; out.height = H;
    const g = out.getContext("2d");
    g.fillStyle = "#0F1013"; g.fillRect(0, 0, W, H);
    const k = 2.6, card = document.createElement("canvas"); card.width = 360 * k; card.height = 504 * k;
    C.drawCard(card.getContext("2d"), pet, k, 1, nick, date, { ...fx, t: Math.PI / 6.4 }); // 手举起来的那一帧
    g.drawImage(card, (W - card.width) / 2, 56);
    // 二维码,白底留边
    const qr = qrcode(0, "M"); qr.addData(SHARE_URL); qr.make();
    const n = qr.getModuleCount(), q = 220, m = q / (n + 8), qx = 92, qy = 56 + card.height + 48;
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(qx, qy, q, q, 16); g.fill();
    g.fillStyle = "#16181D";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(qx + (c + 4) * m, qy + (r + 4) * m, Math.ceil(m), Math.ceil(m));
    const F = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif', tx = qx + q + 44;
    g.fillStyle = "#E6E7EA"; g.font = `800 44px ${F}`; g.fillText("扫码领养你的拼豆伙伴", tx, qy + 66);
    g.fillStyle = "#8C9099"; g.font = `500 28px ${F}`;
    g.fillText("带它闯三关,学会发光和可动", tx, qy + 120);
    g.fillText("闯得越多,能领的小奖品越好", tx, qy + 162);
    g.fillStyle = "#C6F04A"; g.font = `700 26px ${F}`; g.fillText("matterbench.easyfdm.xyz", tx, qy + 208);
    return new Promise((res) => out.toBlob(res, "image/png"));
  }
  $("#shareBtn").addEventListener("click", async () => {
    if (!pet) return;
    const blob = await shareImage(); if (!blob) return;
    const file = new File([blob], `拼豆伙伴卡-${pet.code}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { // 手机:直接调起系统分享
      try { await navigator.share({ files: [file], title: "我的拼豆伙伴", text: `来看看我的拼豆伙伴「${pet.name}」,你也来领养一只:${SHARE_URL}` }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("卡片图已下载,上面有二维码,发给朋友扫一扫就能领养。");
  });

  // ---- 进页面 ----
  const saved = ls.get("mb.card");
  const upLevel = new URLSearchParams(location.search).get("up");
  if (upLevel) history.replaceState(null, "", location.pathname);
  if (saved && Number.isInteger(saved.seed) && saved.seed >= 0 && saved.seed <= 0xffffffff) {
    pet = C.makeCard(saved.seed); nick = String(saved.nick || "").slice(0, 8); date = String(saved.date || "");
    if (upLevel && passed[upLevel]) {
      // 刚过关回来:先按过关前的样子画,再升级
      const before = { ...passed, [upLevel]: false }, prizeBefore = C.prizeFor(pet, before).tier;
      passed = before; renderMine(); paint();
      passed = { ...before, [upLevel]: true };
      (async () => {
        await sleep(500);
        wrapEl.classList.add("shake"); await sleep(700); wrapEl.classList.remove("shake");
        renderMine(); paint(); burst(Math.max(1, pet.lvl)); loop();
        const skill = C.POWERS.find((p) => p.level === upLevel), prizeNow = C.prizeFor(pet, passed).tier;
        toast(`${pet.name}学会了「${skill.name}」!` + (prizeNow !== prizeBefore ? ` 奖品升到${prizeNow.name}。` : ""));
      })();
    } else {
      renderMine(); paint(); loop();
    }
  } else {
    C.drawBack(ctx, DPR);
    renderLevels();
    if (upLevel && passed[upLevel]) toast("过关啦!领养一只伙伴,这个技能就送给它。");
  }
})();
