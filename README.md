# MatterBench site

MatterBench 的宣传页和在线体验,纯静态页面。

- `index.html`:介绍页,中英双语;浏览器里「打印 / 存成 PDF」得到两页 A4 宣传单
- `demo.html`:在线体验主页。先领养一只拼豆伙伴(随机抽卡:普通 / 稀有 / 超稀有 / 传说),再带它闯三关:
  - `pixel.html` 第 1 关 · 拼豆像素画 → 伙伴学会「拼出身体」(卡上从图纸变成实心的豆)
  - `lamp.html` 第 2 关 · 发光拼豆灯罩 → 学会「发光」;关卡本身能导出图纸和 ESP32 代码
  - `puppet.html` 第 3 关 · 会动的豆条小人 → 学会「可动」(卡上两侧装上豆条手臂挥手)
  - 每关右侧有小任务清单(`assets/quest.js`),做完弹「过关」,唯一的按钮带回主页播升级动画;第四个技能「声音」只是预告
  - 奖品:抽到的档位起步,每过一关升一档,最多升 `cardMaxUpgrade` 档;主页唯一的出口是「领奖并报名」
  - 伙伴、过关记录都存在访客浏览器里(清掉网站数据能重来,所以奖品按「每人限领一次」核对)
  - 卡片的生成和绘制在 `assets/cardgen.js`,主页逻辑在 `assets/hub.js`
  - 主页的「分享我的伙伴卡」生成一张带二维码的卡片图(二维码指向 `/demo?utm_source=card`);手机上直接调起系统分享。二维码用 `assets/vendor/qrcode.js`(qrcode-generator 1.4.4,MIT)
- `card.html`:查验页(不对访客展示入口)。贴领奖码或卡号,重新画出同一张卡,给出档位、闯过哪几关、该发什么奖品
  - 查到的卡可以下载拼豆图纸(PNG:行列编号、每格颜色字母、用料数)和数据(JSON),照着做实物
  - 卡号 `MB-XXXX-XXXX` 只决定卡片本身;领奖码在后面多两位 `-XY`:过了哪几关 + 校验位,随手改会显示无效
  - 四档的比例和奖品在 `config.js` 的 `cardTiers`,活动说明在 `cardRules`。上线后别再改比例和 `assets/cardgen.js` 里的生成规则,不然旧号码查出来的卡会变
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
- `utm_content`:点的是哪个入口,如 `hero`、`top`、`card-education`、`demo`;从「领奖并报名」来的是 `lucky-` 加奖品档位(`lucky-n` / `lucky-r` / `lucky-sr` / `lucky-ssr`)
- `utm_term`、`card`:从「领奖并报名」来的会带上领奖码

在 Wix 后台的流量来源里能按这些参数看报名页的访问来源。往外发链接时可以加上 `?utm_source=xxx`,方便区分渠道。

## 领奖表单

Wix 报名表里有一栏「你的伙伴卡号」(要设成选填,普通报名的人没有卡号)。核对时导出表单提交,把这一栏的领奖码贴进 `card.html` 查验:能看到伙伴、闯关记录和该发的奖品,卡片按拼好的样子画,照着就能做实物。

报名链接上带着 `card=领奖码`。想让这一栏自动填好,可以在 Wix 打开开发者模式(Velo),在报名页的页面代码里读 `wixLocation.query.card` 写进去;不加的话访客手动粘贴(主页点按钮时已经帮他复制好)。
