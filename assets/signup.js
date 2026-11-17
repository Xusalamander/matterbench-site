(() => {
  "use strict";
  const cfg = window.MB_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String((new Date()).getFullYear());
  });
  document.querySelectorAll("[data-site-url]").forEach((el) => {
    el.textContent = location.host + location.pathname.replace(/index\.html$/, "");
  });
  const ss = {
    get(k) {
      try {
        return JSON.parse(sessionStorage.getItem(k));
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        sessionStorage.setItem(k, JSON.stringify(v));
      } catch {
      }
    }
  };
  const q = new URLSearchParams(location.search);
  if (q.get("utm_source")) ss.set("mb.from", q.get("utm_source").slice(0, 40));
  let lastCta = ss.get("mb.cta") || "";
  document.querySelectorAll("[data-cta]").forEach((a) => a.addEventListener("click", () => {
    lastCta = a.dataset.cta;
    ss.set("mb.cta", lastCta);
  }));
  function signupHref() {
    const u = new URL(cfg.signupUrl);
    u.searchParams.set("utm_source", "matterbench");
    u.searchParams.set("utm_medium", "website");
    u.searchParams.set("utm_campaign", ss.get("mb.from") || "direct");
    u.searchParams.set("utm_content", ss.get("mb.cta") || lastCta || "join");
    if (ss.get("mb.term")) {
      u.searchParams.set("utm_term", ss.get("mb.term"));
      u.searchParams.set("card", ss.get("mb.term"));
    }
    return u.toString();
  }
  const btns = document.querySelectorAll("[data-signup]"), note = $("[data-signup-note]");
  if (!btns.length) return;
  if (!cfg.signupUrl) {
    btns.forEach((btn) => {
      btn.textContent = "报名表即将开放";
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("is-disabled");
      btn.removeAttribute("target");
      btn.addEventListener("click", (e) => e.preventDefault());
    });
    if (note) note.textContent = "报名页还在准备中,请稍后再来看看。";
    return;
  }
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.href = signupHref();
    });
    btn.href = signupHref();
  });
})();
