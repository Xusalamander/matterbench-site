# MatterBench site

MatterBench 的宣传页和在线体验。纯静态页面,外加一个收集「感兴趣」表单的小后端。

- `index.html`:介绍页,中英双语;浏览器里「打印 / 存成 PDF」得到两页 A4 宣传单
- `demo.html`:在线体验——设计一个会发光的拼豆灯罩(四面拼豆图案 + ESP32 驱动的 RGB 灯板),导出图纸和 ESP32 代码
- `functions/api/lead.js`:Cloudflare Pages Function,把表单写进飞书多维表格

## 本地预览

```bash
python -m http.server 5192
```

打开 http://localhost:5192 。本地没有 `/api/lead`,表单提交会显示「提交没成功」,这是正常的。

## 部署(Cloudflare Pages)

1. Cloudflare → Workers & Pages → Create → Pages → 连接这个 GitHub 仓库。Build command 留空,Output directory 填 `/`。
2. 飞书里建一张多维表格,加 7 个文本列:称呼、联系方式、身份、想参与、想做什么、来源、提交时间。
3. 飞书开放平台建一个自建应用,开多维表格权限,发布;在那张多维表格里把应用加为协作者(可编辑)。
4. Pages 项目 → Settings → Environment variables(生产环境):
   - `FEISHU_APP_ID`、`FEISHU_APP_SECRET`
   - `FEISHU_BASE_TOKEN`(多维表格链接 `/base/` 后面那段)、`FEISHU_TABLE_ID`(`tbl` 开头)
   - `ALLOWED_ORIGIN`(可选):正式网址,如 `https://matterbench.example.com`
5. Pages 项目 → Custom domains → 添加子域名,按提示加 DNS 记录。
6. 提交一条测试,确认表里出现记录。

密钥只放在 Cloudflare 的环境变量里,不要写进仓库。

不用 Cloudflare 的话,把 `config.js` 的 `endpoint` 换成任何接受 JSON POST 的表单服务地址即可。

## 渠道统计

链接后面加 `?utm_source=xxx&utm_campaign=yyy`,提交时会记进「来源」列,连同点击的按钮,以及是否玩过在线体验。
