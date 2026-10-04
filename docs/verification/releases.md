# 发布记录

## 手录版本首次上线

- 发布日期：2026-10-04（Asia/Shanghai）。
- 用户明确授权在 iPhone／Android 实机验收仍待完成的情况下发布当前手录版本。
- 应用版本：0.1.0；发布提交：`1a294376bb2fd0762fc57f689d602ffccf253b27`。
- [Pages 发布运行](https://github.com/unknownparticles/fengshui/actions/runs/37194615838)：成功，构建通过规格、单元测试、生产构建、双路径和浏览器检查后上传 dist。
- 实际站点：[https://alunapp.cn/fengshui/](https://alunapp.cn/fengshui/)；GitHub 默认地址跳转至账号自定义域名。
- Pages 使用 workflow 发布；https_enforced=true，HTTP 301 到 HTTPS。
- 线上入口引用 `/fengshui/assets/` 构建资源，不再包含 `/src/main.tsx` 或 `%BASE_URL%`。
- 逐项 GET：入口、脚本、样式、manifest、4 个图标均为 200 且 MIME 正确，SW 脚本为 200。
- 浏览器确认罗盘页面正常显示，发布提交匹配；`#/knowledge/zi` 直接访问和刷新正常。
- 内置浏览器的离线资源检查及重试仍返回未就绪；缓存状态原因尚未确认，不将此验证记为通过。生产构建 Chromium 本地离线测试已通过，手机安装／离线与传感器正式定向仍需实机验证。
- 手机实机记录未改为通过，传感器正式锁定保持未启用。活动 OpenSpec 变更尚未归档。
