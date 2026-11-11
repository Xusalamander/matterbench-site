// 四关共用的关卡外壳:任务清单、画面左上角的「这一步」卡片、按步骤出现的工具、过关提示。
// 用法:const q = MBQuest.init({ level: "lamp", tasks: [{ id, label, tip, act }] });
//   label:任务清单里的一句;tip:「这一步」卡片上怎么做;act:这一步要学的新动作(卡片上一个小标签)
//   q.done("lightOn");   // 某个任务完成时调用,重复调用没关系
//   q.prog("已对 30 / 120 颗"); // 卡片上这一步的进度
//   页面里写 data-step="3" 的元素,到第 3 步才出现;过关(或以前过过)以后全都出现
//   <details id="moreBox"> 是「更多」:平时收着,过关后自动打开
//   第 4 关按零件算进度,自己画卡片:init 时传 manual: true,再调 q.card({ no, title, tip, act, prog })
// 过关记录存在 localStorage 的 mb.levels,伙伴主页(demo.html)读它点亮伙伴的技能。
(() => {
  "use strict";
  const KEY = "mb.levels";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 隐私模式等 */ } };
  // 每关教会伙伴的技能
  const SKILL = { pixel: "拼出身体", lamp: "发光", puppet: "可动", build: "搭骨架" };
  const LEVEL_NO = { pixel: 1, lamp: 2, puppet: 3, build: 4 };
  const hasCard = () => { try { return !!localStorage.getItem("mb.card"); } catch { return false; } };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function init({ level, tasks, manual = false }) {
    const box = document.querySelector("#quest");
    const doneSet = new Set();
    const passedBefore = !!read()[level];
    const current = () => { const i = tasks.findIndex((t) => !doneSet.has(t.id)); return i < 0 ? tasks.length : i; };
    let opened = false, progText = "";

    function render() {
      if (box) {
        const n = doneSet.size, all = tasks.length, cur = current();
        box.innerHTML = `<h4>本关任务 <span class="quest-count">${n} / ${all}</span></h4>
          <p class="quest-reward">过关奖励:伙伴学会「${SKILL[level]}」,奖品升一档</p>
          ${skillChips()}
          <div class="quest-bar"><i style="width:${(n / all) * 100}%"></i></div>
          <ul class="quest-list">${tasks.map((t, i) => `<li class="${doneSet.has(t.id) ? "is-done" : i === cur ? "is-now" : ""}"><span class="tick"></span>${esc(t.label)}</li>`).join("")}</ul>
          ${passedBefore && n < all ? '<p class="quest-note">你之前已经过了这一关,所有功能都开着,可以随便玩。</p>' : ""}`;
      }
      reveal();
      if (!manual) autoCard();
    }
    // 伙伴现在会的技能(和卡片同一处:MBCard.fxOf);这一关教的那个带个框
    function skillChips() {
      if (!window.MBCard) return "";
      const on = MBCard.fxOf(read());
      return `<div class="skills" aria-label="伙伴学会的技能">${MBCard.POWERS.map((p) => `<span class="skill${on[p.key] ? " is-on" : ""}${p.level === level ? " is-here" : ""}" title="${esc(on[p.key] ? "已学会" : p.how)}">${p.icon} ${esc(p.name)}</span>`).join("")}</div>`;
    }
    // 别的标签页过了关:技能条马上跟着变
    window.addEventListener("storage", (e) => { if (e.key === KEY) render(); });
    // 到第几步才出现的工具;过关或以前过过就全出现
    function reveal() {
      const step = current() + 1, all = passedBefore || current() >= tasks.length;
      document.querySelectorAll("[data-step]").forEach((el) => { el.hidden = !all && +el.dataset.step > step; });
      const more = document.querySelector("#moreBox");
      if (more && all && !opened) { more.open = true; opened = true; }
    }
    function autoCard() {
      const i = current(), t = tasks[i];
      if (t) card({ no: `第 ${LEVEL_NO[level]} 关 · 第 ${i + 1} 步 / ${tasks.length}`, title: t.title || t.label, tip: t.tip || "", act: t.act || "", prog: progText });
      else card({ no: `第 ${LEVEL_NO[level]} 关 · 过关了`, title: `伙伴学会了「${SKILL[level]}」`, tip: "所有功能都打开了,「更多」里还有别的玩法。" });
    }
    // 画面左上角的「这一步」卡片;四关同一个样子
    function card({ no = "", title = "", tip = "", act = "", prog = "", flash = "" }) {
      const el = document.querySelector("#stepCard");
      if (!el) return;
      const same = el.dataset.key === no + title;
      el.innerHTML = `<span class="stage-no">${esc(no)}</span><b>${esc(title)}</b>`
        + (tip ? `<p>${esc(tip)}</p>` : "")
        + (act ? `<span class="stage-act">新动作 · ${esc(act)}</span>` : "")
        + (prog ? `<span class="stage-prog">${esc(prog)}</span>` : "")
        + (flash ? `<span class="stage-new">${esc(flash)}</span>` : "");
      el.dataset.key = no + title;
      if (!same) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
      // 平面画布从卡片下面开始,不被挡住;高度变了就让各关重新排一下画布
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
      back.addEventListener("click", (e) => { if (e.target === back) close(); });
    }

    function done(id) {
      if (doneSet.has(id) || !tasks.some((t) => t.id === id)) return;
      doneSet.add(id);
      const all = doneSet.size === tasks.length;
      if (all) { const v = read(); v[level] = true; write(v); } // 先记过关,技能条才会马上亮
      render();
      if (all) setTimeout(showPass, 350);
    }

    render();
    const prog = (text) => { if (text === progText) return; progText = text || ""; if (!manual) autoCard(); };
    return { done, isDone: (id) => doneSet.has(id), current, card, prog, passedBefore };
  }

  window.MBQuest = { init, levels: read };
})();
