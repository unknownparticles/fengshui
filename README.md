# 风水堪舆现场工具

面向专业罗盘与现场堪舆的浏览器应用规划：二十四山地盘正针、坐向测量、多测点记录、平面图方位叠加、资料查阅和本地报告，支持 PWA 离线使用，目标托管平台为 GitHub Pages。

当前阶段为资料收集和 OpenSpec 设计，应用代码与发布流程尚未实现。

## 阅读入口

- [资料索引与研究结论](docs/research/sources.md)：已核实来源、可靠性、引用限制和对应规格。
- [用户提供的 GitHub 仓库核查](docs/research/github-repositories.md)：实际文件、许可证、版本差异与规则缺陷，以及可参考范围。
- [领域规则与二十四山对照](docs/research/domain-reference.md)：角度约定、完整方位表、坐向与测量规则。
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
