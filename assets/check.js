// 查验页:贴卡号或领奖码,重新画出同一张卡,并给出档位、闯关记录和该发的奖品。
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const C = window.MBCard;
  const ctx = $("#card").getContext("2d");
  const DPR = Math.min(3, window.devicePixelRatio || 1);
  $("#card").width = 360 * DPR; $("#card").height = 504 * DPR;
  const LEVEL_NAME = { pixel: "第 1 关", lamp: "第 2 关", puppet: "第 3 关" };

  function show(code) {
    const res = $("#checkRes"), dl = $("#checkDl");
    res.hidden = false; res.className = "check-res";
    const got = C.decodeAny(code);
    if (!got) {
      C.drawBack(ctx, DPR); dl.hidden = true;
      res.textContent = "✗ 号码无效:不是体验页生成的,或者抄错了字。"; res.classList.add("bad");
      return;
    }
    const pet = C.makeCard(got.seed), passed = got.passed || {};
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

  $("#checkForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#codeIn").value.trim();
    history.replaceState(null, "", v ? "?code=" + encodeURIComponent(v) : location.pathname);
    show(v);
  });
  const q = new URLSearchParams(location.search).get("code");
  if (q) { $("#codeIn").value = q; show(q); } else C.drawBack(ctx, DPR);
})();
