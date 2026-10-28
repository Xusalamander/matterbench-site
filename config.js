// 站点配置:上线前只改这里。
window.MB_CONFIG = {
  // 表单提交地址。部署到 Cloudflare Pages 时用自带的 functions/api/lead.js,保持 "/api/lead" 即可;
  // 也可以换成 Formspree 之类的表单服务地址(接受 JSON POST、返回 2xx 就算成功)。
  endpoint: "/api/lead",
  // 可选:提交失败时给用户的备用联系邮箱(建议用公共邮箱,如 hello@你的域名)。留空则不显示。
  fallbackEmail: "",
};
