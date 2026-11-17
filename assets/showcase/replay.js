(() => {
  "use strict";
  const root = document.querySelector("[data-replay]");
  if (!root || !window.MBShowcase) return;
  const $ = (s) => root.querySelector(s);
  const msgs = $("[data-replay-msgs]"), stepsEl = $("[data-replay-steps]"), panel = $("[data-replay-panel]");
  const toggle = $("[data-replay-toggle]"), restart = $("[data-replay-restart]");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  MBShowcase.ready.then((S) => {
    const R = S.data.replay;
    if (!R) return;
    root.classList.add("has-replay");
    const label = $("[data-replay-label]");
    if (label) label.textContent = R.label;
    const pat = S.data.pattern, N = pat.rows.length;
    const color = (ch) => ch === "." ? null : pat.palette[Number(ch) - 1];
    const board = panel.querySelector(".sc-board"), cells = [];
    for (let k = 0; k < N * N; k++) {
      const c = document.createElement("i");
      board.appendChild(c);
      cells.push(c);
    }
    const paint = (r, i, ch) => {
      const c = cells[r * N + i], v = color(ch);
      c.style.background = v || "";
      c.classList.toggle("on", !!v);
    };
    const chips = R.steps.map((s, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<b>${k + 1}</b>${s.name}`;
      b.addEventListener("click", () => play(k));
      stepsEl.appendChild(b);
      return b;
    });
    let clock = 0, paused = false, gen = 0, waiters = [], prev = null;
    const STOP = {};
    function tick(now) {
      if (prev !== null && !paused) clock += now - prev;
      prev = now;
      waiters = waiters.filter((w) => {
        if (w.g !== gen) {
          w.no(STOP);
          return false;
        }
        if (clock >= w.at) {
          w.ok();
          return false;
        }
        return true;
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    const wait = (g, ms, instant) => instant ? g === gen ? Promise.resolve() : Promise.reject(STOP) : new Promise((ok, no) => waiters.push({ at: clock + ms, ok, no, g }));
    function bubble(who, text) {
      const b = document.createElement("div");
      b.className = "sc-msg " + (who === "me" ? "me" : "ai");
      b.textContent = text;
      msgs.appendChild(b);
      msgs.scrollTop = msgs.scrollHeight;
      return b;
    }
    async function say(g, who, text, instant) {
      if (who === "ai" && !instant) {
        const t = bubble("ai", "");
        t.classList.add("typing");
        t.innerHTML = "<span></span><span></span><span></span>";
        try {
          await wait(g, 900);
        } finally {
          t.remove();
        }
      }
      bubble(who, text);
      await wait(g, 700 + 45 * text.length, instant);
    }
    async function act(g, d, instant) {
      if (d.panel) {
        panel.hidden = false;
        const rows = d.panel === "draft" ? R.draft_rows : pat.rows, now = d.panel === "draft" ? null : R.draft_rows;
        for (let r = 0; r < N; r++) for (let i = 0; i < N; i++) {
          const ch = rows[r][i];
          if (now ? now[r][i] === ch : ch === ".") {
            if (!now) paint(r, i, ch);
            continue;
          }
          paint(r, i, ch);
          if (!instant) await wait(g, now ? 70 : 28);
        }
      }
      if (d.show) {
        if (d.show.includes(4) || d.show.includes(0)) panel.hidden = true;
        for (const k of d.show) {
          S.show(k, instant);
          await wait(g, 450, instant);
        }
      }
      if (d.light) {
        await wait(g, 300, instant);
        S.light(true);
      }
      if (d.spin) S.spin(true);
    }
    function mark(k, done) {
      chips.forEach((c, j) => {
        c.classList.toggle("is-on", j === k);
        c.classList.toggle("is-done", done ? j <= k : j < k);
      });
    }
    async function play(from = 0) {
      const g = ++gen;
      paused = false;
      root.classList.remove("is-paused", "is-done");
      toggle.textContent = "暂停";
      msgs.textContent = "";
      panel.hidden = true;
      cells.forEach((c) => {
        c.style.background = "";
        c.classList.remove("on");
      });
      S.reset();
      try {
        for (let k = 0; k < R.steps.length; k++) {
          const s = R.steps[k], instant = k < from || reduce;
          if (!instant) mark(k);
          for (const [who, text] of s.chat) await say(g, who, text, instant);
          await act(g, s.do, instant);
          await wait(g, 900, instant);
        }
        mark(R.steps.length - 1, true);
        root.classList.add("is-done");
        toggle.textContent = "暂停";
      } catch (e) {
        if (e !== STOP) throw e;
      }
    }
    toggle.addEventListener("click", () => {
      if (root.classList.contains("is-done")) return;
      paused = !paused;
      root.classList.toggle("is-paused", paused);
      toggle.textContent = paused ? "继续" : "暂停";
    });
    restart.addEventListener("click", () => play(0));
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) {
        io.disconnect();
        play(0);
      }
    }, { threshold: 0.35 });
    io.observe(root);
  }).catch(() => {
  });
})();
