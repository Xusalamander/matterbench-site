// 每一关右侧的小任务清单 + 过关提示。三关共用。
// 用法:const q = MBQuest.init({ level: "lamp", tasks: [{ id, label }] });
//       q.done("lightOn");   // 某个任务完成时调用,重复调用没关系
// 过关记录存在 localStorage 的 mb.levels,伙伴主页(demo.html)读它点亮伙伴的技能。
(() => {
  "use strict";
  const KEY = "mb.levels";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 隐私模式等 */ } };
  // 每关教会伙伴的技能
  const SKILL = { pixel: "拼出身体", lamp: "发光", puppet: "可动" };
  const hasCard = () => { try { return !!localStorage.getItem("mb.card"); } catch { return false; } };

  function init({ level, tasks }) {
    const box = document.querySelector("#quest");
    const doneSet = new Set();
    const passedBefore = !!read()[level];

    function render() {
      if (!box) return;
      const n = doneSet.size, all = tasks.length;
      box.innerHTML = `<h4>本关任务 <span class="quest-count">${n} / ${all}</span></h4>
        <p class="quest-reward">过关奖励:伙伴学会「${SKILL[level]}」,奖品升一档</p>
        <div class="quest-bar"><i style="width:${(n / all) * 100}%"></i></div>
        <ul class="quest-list">${tasks.map((t) => `<li class="${doneSet.has(t.id) ? "is-done" : ""}"><span class="tick"></span>${t.label}</li>`).join("")}</ul>
        ${passedBefore && n < all ? '<p class="quest-note">你之前已经过了这一关,可以随便玩。</p>' : ""}`;
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
      render();
      if (doneSet.size === tasks.length) {
        const v = read(); v[level] = true; write(v);
        setTimeout(showPass, 350);
      }
    }

    render();
    return { done, isDone: (id) => doneSet.has(id) };
  }

  window.MBQuest = { init, levels: read };
})();
