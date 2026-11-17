(() => {
  "use strict";
  const KEY = "mb.levels";
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };
  const write = (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
    }
  };
  const SKILL = { pixel: "拼出身体", lamp: "发光", puppet: "可动", build: "搭骨架" };
  const LEVEL_NO = { pixel: 1, lamp: 2, puppet: 3, build: 4 };
  const hasCard = () => {
    try {
      return !!localStorage.getItem("mb.card");
    } catch {
      return false;
    }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function init({ level, tasks, manual = false }) {
    const box = document.querySelector("#quest");
    const doneSet = new Set();
    const passedBefore = !!read()[level];
    const current = () => {
      const i = tasks.findIndex((t) => !doneSet.has(t.id));
      return i < 0 ? tasks.length : i;
    };
    let opened = false, progText = "";
    function render() {
      if (box) {
        const n = doneSet.size, all = tasks.length, cur = current();
        box.innerHTML = `<h4>本关任务 <span class="quest-count">${n} / ${all}</span></h4>
          <p class="quest-reward">过关奖励:伙伴学会「${SKILL[level]}」,奖品升一档</p>
          ${skillChips()}
          <div class="quest-bar"><i style="width:${n / all * 100}%"></i></div>
          <ul class="quest-list">${tasks.map((t, i) => `<li class="${doneSet.has(t.id) ? "is-done" : i === cur ? "is-now" : ""}"><span class="tick"></span>${esc(t.label)}</li>`).join("")}</ul>
          ${passedBefore && n < all ? '<p class="quest-note">你之前已经过了这一关,所有功能都开着,可以随便玩。</p>' : ""}`;
      }
      reveal();
      if (!manual) autoCard();
    }
    function skillChips() {
      if (!window.MBCard) return "";
      const on = MBCard.fxOf(read());
      return `<div class="skills" aria-label="伙伴学会的技能">${MBCard.POWERS.map((p) => `<span class="skill${on[p.key] ? " is-on" : ""}${p.level === level ? " is-here" : ""}" title="${esc(on[p.key] ? "已学会" : p.how)}">${p.icon} ${esc(p.name)}</span>`).join("")}</div>`;
    }
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) render();
    });
    function reveal() {
      const step = current() + 1, all = passedBefore || current() >= tasks.length;
      document.querySelectorAll("[data-step]").forEach((el) => {
        el.hidden = !all && +el.dataset.step > step;
      });
      const more = document.querySelector("#moreBox");
      if (more && all && !opened) {
        more.open = true;
        opened = true;
      }
    }
    function autoCard() {
      const i = current(), t = tasks[i];
      if (t) card({ no: `第 ${LEVEL_NO[level]} 关 · 第 ${i + 1} 步 / ${tasks.length}`, title: t.title || t.label, tip: t.tip || "", act: t.act || "", prog: progText });
      else card({ no: `第 ${LEVEL_NO[level]} 关 · 过关了`, title: `伙伴学会了「${SKILL[level]}」`, tip: "所有功能都打开了,「更多」里还有别的玩法。" });
    }
    function card({ no = "", title = "", tip = "", act = "", prog: prog2 = "", flash = "" }) {
      const el = document.querySelector("#stepCard");
      if (!el) return;
      const same = el.dataset.key === no + title;
      el.innerHTML = `<span class="stage-no">${esc(no)}</span><b>${esc(title)}</b>` + (tip ? `<p>${esc(tip)}</p>` : "") + (act ? `<span class="stage-act">新动作 · ${esc(act)}</span>` : "") + (prog2 ? `<span class="stage-prog">${esc(prog2)}</span>` : "") + (flash ? `<span class="stage-new">${esc(flash)}</span>` : "");
      el.dataset.key = no + title;
      if (!same) {
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
      }
      const view = el.closest(".view"), h = el.offsetTop + el.offsetHeight + 8 + "px";
      if (view && view.style.getPropertyValue("--card-h") !== h) {
        view.style.setProperty("--card-h", h);
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }
    }
    function showPass() {
      const back = document.createElement("div");
      back.className = "modal-back pass-back";
      back.innerHTML = `<div class="modal pass" role="dialog" aria-modal="true">
        <div class="pass-badge">★</div>
        <h2>过关!</h2>
        <p>${hasCard() ? `你的伙伴学会了「${SKILL[level]}」,奖品也升了一档。` : `学会了「${SKILL[level]}」。领养一只拼豆伙伴,这个技能就送给它。`}</p>
        <div class="pass-actions">
          <a class="btn-go" href="demo.html?up=${level}">${hasCard() ? "回去看看我的伙伴" : "去领养伙伴"} →</a>
          <button class="btn-sub" data-close>留在这一关继续玩</button>
        </div>
      </div>`;
      document.body.appendChild(back);
      const close = () => back.remove();
      back.querySelector("[data-close]").addEventListener("click", close);
      back.addEventListener("click", (e) => {
        if (e.target === back) close();
      });
    }
    function done(id) {
      if (doneSet.has(id) || !tasks.some((t) => t.id === id)) return;
      doneSet.add(id);
      const all = doneSet.size === tasks.length;
      if (all) {
        const v = read();
        v[level] = true;
        write(v);
      }
      render();
      if (all) setTimeout(showPass, 350);
    }
    render();
    const prog = (text) => {
      if (text === progText) return;
      progText = text || "";
      if (!manual) autoCard();
    };
    return { done, isDone: (id) => doneSet.has(id), current, card, prog, passedBefore };
  }
  window.MBQuest = { init, levels: read };
})();
