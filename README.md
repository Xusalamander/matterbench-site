# MatterBench site

MatterBench 的宣传页和在线体验,纯静态页面。

- `index.html`:介绍页,中英双语;浏览器里「打印 / 存成 PDF」得到两页 A4 宣传单
- `demo.html`:在线体验——设计一个会发光的拼豆灯罩(四面图案、ESP32 驱动的 RGB 灯板灯效),导出图纸和 ESP32 代码
- 报名:页面上的「填写报名表」按钮跳到 Wix 上的报名页,地址写在 `config.js` 的 `signupUrl`

## 本地预览

```bash
python -m http.server 5192
```

打开 http://localhost:5192 。

## 部署

托管在 Cloudflare Pages,连着这个仓库:Build command 留空,Output directory 填 `/`。main 分支有新提交,约一分钟后自动上线。

访问统计用 Cloudflare Web Analytics:Pages 项目 → Metrics → Web Analytics → Enable,不用改代码。

## 报名来源

跳到报名页的链接会带上:

- `utm_source=matterbench`、`utm_medium=website`
- `utm_campaign`:访客进站时带的 `utm_source`(没有就是 `direct`)
- `utm_content`:点的是哪个入口,如 `hero`、`top`、`card-education`、`demo`

在 Wix 后台的流量来源里能按这些参数看报名页的访问来源。往外发链接时可以加上 `?utm_source=xxx`,方便区分渠道。
