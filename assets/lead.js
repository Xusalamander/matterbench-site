// 宣传页的留言表单:校验 → POST JSON 到 MB_CONFIG.endpoint。
// 顺带记下访客从哪来(utm_* 参数、来源页、点的是哪个按钮),用来比较不同渠道的兴趣。
(() => {
  "use strict";
  const cfg = window.MB_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const form = $("#leadForm");
  const msg = $("#formMsg");
  const F = form.elements; // 别用 form.name:那是表单自己的 name 属性

  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  document.querySelectorAll("[data-site-url]").forEach((el) => { el.textContent = location.host + location.pathname.replace(/index\.html$/, ""); });

  // ---- 来源:带 utm 参数进站时记下来(本次会话内保留),没带就沿用之前的或只记来源页 ----
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等 */ } },
  };
  const q = new URLSearchParams(location.search);
  const fresh = { referrer: document.referrer || "" };
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"]) if (q.get(k)) fresh[k] = q.get(k).slice(0, 80);
  const hasTag = Object.keys(fresh).length > 1;
  let source = hasTag ? fresh : (ss.get("mb.source") || fresh);
  ss.set("mb.source", source);
  // 从体验页点「我感兴趣」过来的,体验页会在 sessionStorage 里留下 mb.cta / mb.demo
  let lastCta = ss.get("mb.cta") || "";
  document.querySelectorAll("[data-cta]").forEach((a) => a.addEventListener("click", () => { lastCta = a.dataset.cta; }));

  // ---- 合作卡片 → 选中表单里的身份 ----
  function selectRole(role) {
    const r = form.querySelector(`input[name="role"][value="${role}"]`);
    if (r) r.checked = true;
    document.querySelectorAll("button.partner").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.role === role)));
  }
  document.querySelectorAll("button.partner").forEach((b) => b.addEventListener("click", () => {
    selectRole(b.dataset.role);
    lastCta = "card-" + b.dataset.role;
    $("#join").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("#f-name").focus({ preventScroll: true }), 500);
  }));
  form.addEventListener("change", (e) => { if (e.target.name === "role") selectRole(e.target.value); });

  // ---- 校验 ----
  function mark(field, bad, text) {
    const box = field.closest(".fld") || field.closest(".agree");
    box.classList.toggle("invalid", bad);
    let err = box.querySelector(".err");
    if (bad && !err) { err = document.createElement("p"); err.className = "err"; box.appendChild(err); }
    if (err) { err.textContent = bad ? text : ""; if (!bad) err.remove(); }
  }
  function validate() {
    const name = F.name.value.trim(), contact = F.contact.value.trim();
    let ok = true;
    mark(F.name, !name, "请填一个称呼");
    if (!name) ok = false;
    const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const looksOther = /^[\w\-+.@]{5,}$/.test(contact); // 微信号 / 手机号
    const cBad = !contact || !(looksEmail || looksOther);
    mark(F.contact, cBad, contact ? "看起来不像邮箱或微信号" : "请留一个联系方式");
    if (cBad) ok = false;
    mark(F.agree, !F.agree.checked, "需要你同意我们联系你");
    if (!F.agree.checked) ok = false;
    return ok;
  }

  // 玩过体验页的话:拼了多少颗、几种颜色、选的灯效(没玩过为空)
  function demoInfo() {
    const d = ss.get("mb.demo");
    return d && typeof d === "object" ? Object.entries(d).map(([k, v]) => `${k}=${String(v).slice(0, 20)}`).join(",") : "";
  }

  function payload() {
    return {
      name: F.name.value.trim(),
      contact: F.contact.value.trim(),
      role: (form.querySelector('input[name="role"]:checked') || {}).value || "",
      interests: [...form.querySelectorAll('input[name="interest"]:checked')].map((i) => i.value),
      idea: F.idea.value.trim(),
      website: F.website.value, // 蜜罐,真人不会填
      source: { ...source, cta: lastCta, demo: demoInfo() },
      page: location.pathname,
      lang: navigator.language || "",
      submittedAt: new Date().toISOString(),
    };
  }

  function showThanks(name) {
    form.innerHTML = `<div class="thanks"><div class="big">🙌</div><h3>收到了,谢谢 ${escapeHtml(name)}!</h3><p class="en" style="margin:0">我们会尽快通过你留的方式联系你。<br>Thanks — we'll be in touch soon.</p></div>`;
  }
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function fail(text) {
    msg.className = "form-msg bad";
    msg.textContent = text;
    if (cfg.fallbackEmail) {
      msg.append(" 也可以直接写信到 ");
      const a = document.createElement("a");
      a.href = "mailto:" + cfg.fallbackEmail + "?subject=" + encodeURIComponent("MatterBench 交流");
      a.textContent = cfg.fallbackEmail;
      msg.append(a, "。");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "form-msg"; msg.textContent = "";
    if (!validate()) { msg.className = "form-msg bad"; msg.textContent = "还有几项需要补一下。"; return; }
    const data = payload();
    if (!cfg.endpoint) { fail("表单还没有接上提交地址(config.js 里的 endpoint)。"); console.info("[MatterBench] 待提交:", data); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "提交中…";
    try {
      const res = await fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      showThanks(data.name);
    } catch (err) {
      btn.disabled = false; btn.textContent = "提交 / Submit";
      fail("提交没成功,请稍后再试。");
      console.warn("[MatterBench] 提交失败", err);
    }
  });
})();
