// Cloudflare Pages Function:POST /api/lead → 写一条记录到飞书多维表格。
// 密钥只放在 Cloudflare 的环境变量里,不进前端:
//   FEISHU_APP_ID / FEISHU_APP_SECRET  飞书自建应用(需开通多维表格权限,并把应用加为该 Base 的协作者)
//   FEISHU_BASE_TOKEN                  多维表格 app_token(Base 链接 /base/ 后面那段)
//   FEISHU_TABLE_ID                    数据表 id(tbl 开头)
//   ALLOWED_ORIGIN(可选)              只接受这个来源的提交,如 https://matterbench.example.com
// 表里需要这几列(都建成「文本」类型最省事):
//   称呼、联系方式、身份、想参与、想做什么、来源、提交时间
// 飞书是国际版 Lark 的话,把 FEISHU_HOST 设成 https://open.larksuite.com。

const ROLE = { creator: "学员 / 创作者", education: "高校 / 教育机构", tech: "技术 / 供应链", industry: "投资 / 行业伙伴", other: "其他" };
const INTEREST = { prototype: "原型体验", workshop: "课程 / 工作坊", cocreate: "案例共创", partner: "商务合作", updates: "先关注动态" };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  if (env.ALLOWED_ORIGIN && request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json({ ok: false, error: "origin" }, 403);
  if (Number(request.headers.get("Content-Length") || 0) > 8000) return json({ ok: false, error: "too_large" }, 413);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

  // 蜜罐有内容 = 机器人;装作成功,不写表
  if (d.website) return json({ ok: true });

  const name = clip(d.name, 40), contact = clip(d.contact, 80);
  if (!name || !contact) return json({ ok: false, error: "missing" }, 400);

  const src = d.source && typeof d.source === "object" ? d.source : {};
  const source = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref", "cta", "demo", "referrer"]
    .filter((k) => src[k]).map((k) => `${k}=${clip(src[k], 120)}`).join("; ");

  const fields = {
    "称呼": name,
    "联系方式": contact,
    "身份": ROLE[d.role] || "",
    "想参与": (Array.isArray(d.interests) ? d.interests : []).map((i) => INTEREST[i]).filter(Boolean).join("、"),
    "想做什么": clip(d.idea, 600),
    "来源": source,
    "提交时间": new Date().toISOString(),
  };

  const host = env.FEISHU_HOST || "https://open.feishu.cn";
  try {
    const t = await fetch(`${host}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
    }).then((r) => r.json());
    if (t.code !== 0) throw new Error("token " + t.code);

    const r = await fetch(`${host}/open-apis/bitable/v1/apps/${env.FEISHU_BASE_TOKEN}/tables/${env.FEISHU_TABLE_ID}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${t.tenant_access_token}` },
      body: JSON.stringify({ fields }),
    }).then((x) => x.json());
    if (r.code !== 0) throw new Error("record " + r.code + " " + (r.msg || ""));
  } catch (err) {
    console.error("lead write failed", err);
    return json({ ok: false, error: "store" }, 502);
  }
  return json({ ok: true });
}

