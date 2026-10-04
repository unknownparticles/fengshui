# 风水堪舆现场工具

面向专业罗盘与现场堪舆的浏览器应用规划：二十四山地盘正针、坐向测量、多测点记录、平面图方位叠加、资料查阅和本地报告，支持 PWA 离线使用，目标托管平台为 GitHub Pages。

当前已实现手工罗盘、项目测点、复测坐向、观察与图纸、完整备份、报告快照和 PWA 离线／更新。传感器仅检测能力，正式手机北向和发布仍待实机验收。

## 仓库与部署目标

- GitHub 仓库：[unknownparticles/fengshui](https://github.com/unknownparticles/fengshui)。
- Git remote：`https://github.com/unknownparticles/fengshui.git`，本地别名 `origin`。
- 本地初始分支：`main`。2026-10-04 已推送实现代码并核实远端默认分支为 main。
- GitHub Pages 地址：[alunapp.cn/fengshui/](https://alunapp.cn/fengshui/)；[GitHub 默认地址](https://unknownparticles.github.io/fengshui/) 重定向至账号自定义域名。
- 项目部署基路径：`/fengshui/`；manifest 入口与 SW scope 同步采用该路径。

PR／main 推送仅校验，发布通过手动 Actions 工作流构建并上传 `dist`。用户已授权发布当前自动验证通过的手录版本；手机实机记录保持待完成，正式传感器定向保持未启用。

## 阅读入口

- [资料索引与研究结论](docs/research/sources.md)：已核实来源、可靠性、引用限制和对应规格。
- [用户提供的 GitHub 仓库核查](docs/research/github-repositories.md)：实际文件、许可证、版本差异与规则缺陷，以及可参考范围。
- [UI 参考核查](docs/research/ui-references.md)与[UI 设计约定](docs/design/ui-guidelines.md)：参考项目边界、瓷白／墨黑主题、页面层级、状态和访问性。
- [领域规则与二十四山对照](docs/research/domain-reference.md)：角度约定、完整方位表、坐向与测量规则。
- [开发与发布说明](docs/deployment.md)：本地验证、发布门槛、备份恢复和回滚。
- [实施验证记录](docs/verification/implementation.md)：已执行检查与待实机项目。
- [验收矩阵](docs/acceptance.md)：计算边界、实机兼容性、离线与发布验收。
- [变更提案](openspec/changes/build-field-survey-pwa/proposal.md)：首版产品范围与后续方向。
- [技术设计](openspec/changes/build-field-survey-pwa/design.md)：架构、存储、传感器适配和部署方案。
- [实施任务](openspec/changes/build-field-survey-pwa/tasks.md)：按依赖排序的开发任务与验证方法。
- [功能规格](openspec/changes/build-field-survey-pwa/specs/)：七项能力的需求和验收场景。

## 规格状态

`openspec/specs/` 目前为空。新需求保存在活动变更中；待应用实现和验收完成后再归档，形成正式规格，避免把规划写成已上线能力。

```sh
OPENSPEC_TELEMETRY=0 openspec status --change build-field-survey-pwa
OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive
```

## 已确定的首版边界

专业现场工作流优先；采用地盘正针二十四山与后天八卦，完整支持手工输入实体罗盘读数。传感器测量为设备能力增强，只有经过北向基准验证的适配器才能参与正式定向。首版提供传统术语和现场资料整理，不自动生成吉凶结论。

三合天盘／人盘、分金、玄空飞星、八宅、八字、AR、在线地图、云同步与 AI 咨询列入后续独立变更，不属于当前开发任务。品牌名称与视觉细节可在实施阶段调整。

## 本地开发

使用 Node.js 24 LTS：

```sh
npm ci
npm run dev
npm test
npm run build
npm run check:paths
npm run test:e2e
npm run test:root
```

默认访问 `/fengshui/`，需要根路径构建时使用 `DEPLOY_BASE_PATH=/ npm run build`。

目前已完成 33／39 项实施任务。GitHub 首次完整[校验通过](https://github.com/unknownparticles/fengshui/actions/runs/37193101394)，待办见任务清单；当前变更保持活动状态，尚未归档。
