// 每一关右侧的小任务清单 + 过关提示。三关共用。
// 用法:const q = MBQuest.init({ level: "lamp", tasks: [{ id, label }], next: { href, label } });
//       q.done("lightOn");   // 某个任务完成时调用,重复调用没关系
// 过关记录存在 localStorage 的 mb.levels,选关页读它显示 ✓。
(() => {
  "use strict";
  const KEY = "mb.levels";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 隐私模式等 */ } };

  function init({ level, tasks, next }) {
    const box = document.querySelector("#quest");
    const doneSet = new Set();
    const passedBefore = !!read()[level];

    // 从体验页去报名的,带上是哪一关(报名链接上会变成 utm_content=demo-xxx)
    document.querySelectorAll("[data-go-join]").forEach((a) => a.addEventListener("click", () => {
      try { sessionStorage.setItem("mb.cta", JSON.stringify("demo-" + level)); } catch { /* 忽略 */ }
    }));

    function render() {
      if (!box) return;
      const n = doneSet.size, all = tasks.length;
      box.innerHTML = `<h4>本关任务 <span class="quest-count">${n} / ${all}</span></h4>
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
        <p>这一关的任务都完成了。</p>
        <div class="pass-actions">
          ${next ? `<a class="btn-go" href="${next.href}">${next.label} →</a>` : ""}
          <a class="btn-sub pass-join" href="index.html#join" data-go-join>想要实物版?我感兴趣</a>
          <button class="btn-sub" data-close>继续玩</button>
        </div>
      </div>`;
      document.body.appendChild(back);
      back.querySelector("[data-go-join]").addEventListener("click", () => {
        try { sessionStorage.setItem("mb.cta", JSON.stringify("demo-" + level)); } catch { /* 忽略 */ }
      });
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
