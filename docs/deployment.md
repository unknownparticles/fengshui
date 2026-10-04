# 开发、发布与恢复

仓库：[unknownparticles/fengshui](https://github.com/unknownparticles/fengshui)。目标 Pages 地址：[unknownparticles.github.io/fengshui/](https://unknownparticles.github.io/fengshui/)。当前应用处于实施与验收阶段，正式发布前仍需完成实机记录。

## 本地开发与验证

使用 Node.js 24 LTS：

```sh
npm ci
npm run dev
npm run check:spec
npm test
npm run build
npm run check:paths
npx playwright install chromium
npm run test:e2e
npm run test:root
```

开发地址 `/fengshui/`。离线与安装在生产构建预览中验证：`npm run preview`；开发服务不会提供正式离线缓存。根路径产物为 `dist-root/`，只用于第二套路径验收。所有测试使用自动生成的测试项目与图纸。

## 发布门槛

1. 在 iPhone Safari／主屏幕应用和 Android Chrome／安装应用中完成手录闭环、图片、报告、备份、离线冷启动与更新检查。传感器来源只有明确参考北、方向符号、姿态与精度行为后才能启用；没有验证时保持手录降级。
2. 将型号、系统、浏览器、日期、证据写入 `docs/verification/manual-checks.json`；对应验收均通过后才将 `releaseReady` 设为 true。不得用桌面 Chromium 测试代替手机实机记录。
3. 更新 README 和验收记录，提交到 main；核实 main 为远端默认分支。
4. 在 GitHub Settings → Pages 将 Source 设为 GitHub Actions，检查 HTTPS。
5. 手动运行“正式发布页面”。构建任务先检查实机记录、规格、单元测试、生产构建和两套浏览器测试，只上传 dist；部署任务依赖成功构建。PR 和普通推送只运行验证，不自动正式发布。
6. 检查实际目标地址、manifest、图标、SW scope、资料深层刷新和安装入口；记录发布提交。应用设置页显示构建提交。

## 备份与数据迁移

下载完整备份包含项目地点、坐标、照片、图纸、原始测量、坐向修订和报告；脱敏 HTML 报告只含用户选择的字段。先保存完整备份，再进行清理、浏览器／设备迁移或域名迁移。导入会先预览并校验，同标识项目另建副本，失败不留下部分数据。

数据格式首次发行版本为 1。升级至未来数据版本之前，须生成旧版本可恢复备份并实现迁移测试；当前未知新版本以只读方式打开，可识别项目可查看，无法识别的数据保留在原始数据导出中，禁止初始化覆盖旧数据库。原始数据备份是恢复线索，不等同于当前版本可直接导入的完整 ZIP。

## 回滚

回滚前先下载项目完整备份。重新发布上一已验证提交的静态产物，记录新发布对应的旧代码提交；不自动对浏览器数据库做反向迁移。较旧应用遇到未知数据版本时保留只读和原始备份出口，不清空数据。新版本下载后会等待所有应用页面保存或停止采集，用户确认后才刷新。

## 开发依赖审计

2026-10-04：浏览器运行依赖审计无已知问题；完整 npm 审计报告 4 个高风险条目来自 OpenSpec 开发校验器的 fast-glob／micromatch／braces 依赖链。当日注册表 braces 最新为 3.0.3，未有兼容修复版本；未强制回退 OpenSpec 到无法处理当前规格的旧版本。该链不进入前端构建，CI 只对仓库内本地规格执行校验。后续依赖更新时继续复核。
