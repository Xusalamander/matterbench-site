// 站点配置:上线前只改这里。
window.MB_CONFIG = {
  // Wix 上报名页的完整地址,例如 "https://www.easyfdm.xyz/matterbench-signup"。
  // 留空时,报名按钮显示「报名表即将开放」。
  signupUrl: "https://www.easyfdm.xyz/contact",

  // 拼豆伙伴卡(在线体验 demo.html 领养)的四档稀有度:weight 是抽中的相对比例,prize 是这一档的奖品。
  // 卡片的稀有度由卡号算出来;上线后再改 weight,旧卡号查验出来的稀有度可能会变。
  cardTiers: [
    { id: "N",   name: "普通",   weight: 60, prize: "MatterBench 拼豆贴纸 1 张" },
    { id: "R",   name: "稀有",   weight: 28, prize: "拼豆钥匙扣 1 个" },
    { id: "SR",  name: "超稀有", weight: 10, prize: "把你的伙伴拼成实物:定制拼豆徽章 1 枚" },
    { id: "SSR", name: "传说",   weight: 2,  prize: "原型体验优先名额 + 定制拼豆小物" },
  ],
  // 闯关升档:每过一关奖品升一档,最多升几档(封顶最高档)
  cardMaxUpgrade: 2,
  // 体验页底部的活动说明,一行一条(「每过一关升一档」那条会自动加在最后)
  cardRules: [
    "每台设备可以领养一只伙伴,它和闯关记录都保存在这个浏览器里。",
    "领奖:点「领奖并报名」,把领奖码填在报名表的「伙伴卡号」一栏并提交;我们按领奖码核对、制作,再联系你寄送。",
    "每人限领一次,奖品数量有限,送完为止。",
  ],
};
