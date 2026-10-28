// 报名按钮:跳到 Wix 上的报名页(地址在 config.js 的 signupUrl)。
// 链接上带 utm 参数,Wix 后台的流量来源里能看出是从这个网站、哪个按钮过去的。
(() => {
  "use strict";
  const cfg = window.MB_CONFIG || {};
  const $ = (s) => document.querySelector(s);

  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  document.querySelectorAll("[data-site-url]").forEach((el) => { el.textContent = location.host + location.pathname.replace(/index\.html$/, ""); });

  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等 */ } },
  };

  // 访客自己带着 utm_source 进站的话(比如从小红书链接来),记下来,转给 Wix 当 campaign
  const q = new URLSearchParams(location.search);
  if (q.get("utm_source")) ss.set("mb.from", q.get("utm_source").slice(0, 40));

  // 最后点的是哪个入口;从在线体验页过来的,体验页会留下 mb.cta = "demo"
  let lastCta = ss.get("mb.cta") || "";
  document.querySelectorAll("[data-cta]").forEach((a) => a.addEventListener("click", () => { lastCta = a.dataset.cta; ss.set("mb.cta", lastCta); }));

  function signupHref() {
    const u = new URL(cfg.signupUrl);
    u.searchParams.set("utm_source", "matterbench");
    u.searchParams.set("utm_medium", "website");
    u.searchParams.set("utm_campaign", ss.get("mb.from") || "direct");
    u.searchParams.set("utm_content", lastCta || "join");
    return u.toString();
  }

  const btn = $("[data-signup]"), note = $("[data-signup-note]");
  if (!btn) return;
  if (!cfg.signupUrl) {
    btn.textContent = "报名表即将开放";
    btn.setAttribute("aria-disabled", "true");
    btn.classList.add("is-disabled");
    btn.removeAttribute("target");
    if (note) note.textContent = "报名页还在准备中,请稍后再来看看。";
    btn.addEventListener("click", (e) => e.preventDefault());
    return;
  }
  // 点击时再拼链接,带上最新的入口信息
  btn.addEventListener("click", () => { btn.href = signupHref(); });
  btn.href = signupHref();
})();
