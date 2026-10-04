# 用户提供仓库的核查与复用结论

核查日期：2026-10-04（Asia/Shanghai）。本次阅读 GitHub 页面、技能文档、参考文件、许可证与相关源代码，未安装技能、运行仓库代码或下载课程。下述缺陷来自静态阅读；不代表完整运行测试或对所有传统规则的独立学术验证。

## 仓库对照

| 仓库 | 实际内容 | 许可情况 | 首版采用方式 |
| --- | --- | --- | --- |
| [voidforall/fengshui.skill](https://github.com/voidforall/fengshui.skill) | SKILL.md、3 个参考文件、对话示例；提供顾问问询和输出框架 | 本次所见根目录及 README 未见明确复用许可证，开放标准说明不等于内容授权 | 参考信息收集与报告结构，原创整理；算法资料列待复核，不直接内置文本或规则 |
| [dglijin-oss/chinese-metaphysics-skills](https://github.com/dglijin-oss/chinese-metaphysics-skills/tree/main/fengshui-skill) | 风水模块有技能文档、JavaScript、Python 脚本及 LICENSE；技能 v4.0.0 与代码／README 版本不一致 | 风水模块 LICENSE 为 MIT，Copyright (c) 2026 天工长老；不能据此推定整个合集同一许可 | 模块划分和字段设计参考；任何代码复用须保留许可并先解决下述问题，不作为首版运行依赖 |
| [ar-gen-tin/fengshui](https://github.com/ar-gen-tin/fengshui) | 已于 2026-07-06 归档；查看的罗盘教学和综合典籍目录仅含 .gitkeep | README 标注仅学习研究、勿用于商业用途，未见可覆盖所有书籍的开放许可证 | 分类目录线索；不能认定已取得 16 套罗盘课程或完整古籍文件 |

Skill 是供智能体使用的知识／指令包，安装后不会自动成为浏览器可用的 PWA 算法库。后续扩展排盘仍需确定性本地算法、完整输入、规则版本和独立例盘。

## 核查快照

页面默认分支均为 main；核查时首页可见提交如下。文件链接固定到该提交，后续引用需同时保存路径与内容摘要，不能仅存易变化的 main 链接。

| 来源编号 | 仓库提交 | 本次读取范围 |
| --- | --- | --- |
| S13 | `91762ccda4ea106260ff43f336df14adf08ae57d` | [README](https://github.com/voidforall/fengshui.skill/blob/91762ccda4ea106260ff43f336df14adf08ae57d/README.md)、[SKILL](https://github.com/voidforall/fengshui.skill/blob/91762ccda4ea106260ff43f336df14adf08ae57d/SKILL.md)、[飞星参考](https://github.com/voidforall/fengshui.skill/blob/91762ccda4ea106260ff43f336df14adf08ae57d/references/feixing.md)、references 文件列表 |
| S14 | `2542ead6adb2fac1807e8eb801a95e39409cfeed` | [风水 README](https://github.com/dglijin-oss/chinese-metaphysics-skills/blob/2542ead6adb2fac1807e8eb801a95e39409cfeed/fengshui-skill/README.md)、[SKILL](https://github.com/dglijin-oss/chinese-metaphysics-skills/blob/2542ead6adb2fac1807e8eb801a95e39409cfeed/fengshui-skill/SKILL.md)、[LICENSE](https://github.com/dglijin-oss/chinese-metaphysics-skills/blob/2542ead6adb2fac1807e8eb801a95e39409cfeed/fengshui-skill/LICENSE)、[index.js](https://github.com/dglijin-oss/chinese-metaphysics-skills/blob/2542ead6adb2fac1807e8eb801a95e39409cfeed/fengshui-skill/index.js)、[Python 脚本](https://github.com/dglijin-oss/chinese-metaphysics-skills/blob/2542ead6adb2fac1807e8eb801a95e39409cfeed/fengshui-skill/scripts/fengshui_pan.py) |
| S15 | `49c6e4656fe6673e86156f7d50675e7832c5d2e6` | [README](https://github.com/ar-gen-tin/fengshui/blob/49c6e4656fe6673e86156f7d50675e7832c5d2e6/README.md)、[罗盘教学](https://github.com/ar-gen-tin/fengshui/tree/49c6e4656fe6673e86156f7d50675e7832c5d2e6/03-%E7%BD%97%E7%9B%98%E6%95%99%E5%AD%A6)、[综合典籍](https://github.com/ar-gen-tin/fengshui/tree/49c6e4656fe6673e86156f7d50675e7832c5d2e6/05-%E7%BB%8F%E5%85%B8%E5%8F%A4%E7%B1%8D/%E7%BB%BC%E5%90%88%E5%85%B8%E7%B1%8D)、根目录和古籍子分类列表 |

## S13：适合参考的工作流程及规则缺口

可参考“先确认朝向与户型、再收集环境信息、最后按来源组织报告”的流程，以及形势／理气分模块的结构。项目中的取向对象仍由现场人员明确区分，不能照搬“大门或主窗方向即建筑坐向”的简化问法。虚构顾问人物的师承不作为规则来源证明。

具体缺口：

- `references/feixing.md` 的阴阳山向表仅列 12 地支，缺少 8 天干和 4 维卦，不能覆盖完整二十四山。
- 该表将子列为阳，而 S14 的三元龙表将子列为阴。两个 Skill 的阴阳表不一致，须先确定体系与所依版本，不能相互拼接。
- 流年表给出 2026 中宫星 2；S14 Python 表给出 1。同年参数产生不同候选规则，当前不选任一值作为标准答案。
- 同一飞星文件把“山星下水”解释为财旺人丁弱，SKILL 表达示例又把“向星下水”写成财运受困，与其“向星管财”及下水含义存在解释疑点。
- 主技能的出生年份简算法、五黄处理、八宅游年表和入宅／建造年份取运仍需原典版本复核；没有精确立春时间、历法边界或完整下卦例盘即可运行的保证。

结论：作为问询与内容结构的二手参考；规则仍处于待复核状态，不能把声明“支持玄空飞星”当成完整排盘验证结果。

## S14：声明功能与实际实现的差异

1. **版本与入口不同**：SKILL frontmatter 为 v4.0.0；README 示例主要为 v2.0.0；index.js 文件头写 v1.1，后续带 v2.1／v2.2 片段；Python 文件和 CLI 写 v3.3.0。SKILL 示例含 `--method xuan Kong`，实际 Python argparse 没有 `--method` 参数。
2. **年份写死**：Python 综合排盘内部 `current_year = 2026`，格式化输出也写死 2026；命卦输入仅年而无日期。技能文档所述校验当前时间、农历年份和立春边界没有在该入口实现。
3. **流年算法自身不连续**：Python 2024—2043 表从 2024=3 开始，其通用表达式在代入 2024 时得到 5，在 2026 时得到 3，而表内 2026=1。表与通用计算不是同一套连续规则；不可用该脚本作独立金标准。
4. **八宅方位重复**：Python `YOU_NIAN['震']` 将五鬼和六煞均设为艮，`巽` 将生气和祸害均设为坎；转换为按方位索引的字典会覆盖前一条，导致输出缺项。index.js 的离、巽、坤也存在重复方向。即使不判断哪条正确，也应要求八方唯一且完整。
5. **命卦表与说明不符**：SKILL 给出“5 男坤女艮”，女性 1990 示例却写坤；Python 对余数 5 一律回退坤。世纪转换及年份界限也未在现有实现中完整说明。
6. **JavaScript 可执行性存疑**：index.js 多处对象键值使用全角 `：`；README 示例使用 `fengshui_pan`，实际导出为 `fengShui`。需先通过语法和 API 对齐检查，不能视为可直接引入的浏览器模块。本次未运行验证。
7. **不是完整下卦引擎**：Python 未实现运盘／山盘／向盘的完整下卦或替卦入口；JavaScript 飞星函数以年份余数和八方向索引作简化计算，二十四山函数只返回每方三山而无角度区间。v4 文档中的 108 组合、月飞星、城门诀和七星打劫不能据这些入口证明已实现。
8. **评分与观察脱节**：JavaScript 综合评分主要由宅命匹配得到固定增减分，另一评分片段加入固定基础 45 分；没有采集实际门、卧室和厨房位置。不能把这种分数映射为现场检查结果。

结论：MIT 许可允许按条件复用该模块软件，但许可与算法正确性是两回事。首版只参考模块结构；后续需要自行实现或修复，并对照独立例盘，不能把 Python 直接部署到 Pages，也不默认增加浏览器 Python 运行时。

## S15：目录声明与可获得文件

README 声称零基础 54 套、择日 25 套、罗盘 16 套、职业 171 套。核查到罗盘教学和综合典籍只有 `.gitkeep`；未核实这些套数为该仓库中可取得的实际文件数量。README 的分类链接还指向 `acchaacc/fengshui`，不是用户提供的仓库；该外部仓库本次未进一步核查。

可记录“零基础／罗盘／形势／理气／综合／现代研究”的资料组织线索，但不能登记不存在的书籍为已获取来源。古籍书名、现代扫描、课程和研究论文分别核对具体文件、作者、版本、页码和再发布授权后，才可进入应用资料库。

## 对 OpenSpec 的具体补充

- 来源记录增加仓库、固定提交、文件路径、内容版本及审核结论；“可访问”“有许可证”“规则已核验”各有状态，不互相替代。
- 声称提供课程但无文件、仅有占位目录、许可未知或规则冲突的来源仅保留参考线索，不内置正文或启用自动解释。
- 首版不新增 Skill 安装或 AI 运行依赖。原有地盘正针、测点记录和离线报告的范围保持成立。
- 后续独立排盘提案应先处理：采用哪套原典、坐／向口径、北向基准、起运依据、历法与时区、立春界限、三元龙阴阳、兼向／替卦，以及缺失输入的行为。
- 后续例盘验收至少覆盖完整 24 山、九宫／八方唯一性、跨零角度、同一日期不同源码的一致性、世纪及节气边界、源数据缺项和版本升级，不以相互抄录的 Skill 输出互证正确。
