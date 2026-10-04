# 资料索引与研究结论

研究日期：2026-10-04（Asia/Shanghai）。以下“已核实”指本次浏览阅读过相关正文；“待复核”不作为首版算法依据。本文为中文归纳，不复制网站整篇正文或罗盘商品图。

## 已核实来源

| 编号 | 来源与链接 | 阅读到的事实 | 对项目的影响 |
| --- | --- | --- | --- |
| S01 | [GitHub：What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | Pages 托管 HTML、CSS、JavaScript 静态资源；项目站点位于 `/<repository>/`；托管方会记录访问 IP | 核心功能在本地执行；“不上传现场数据”不等于网站访问完全无日志 |
| S02 | [GitHub：Using custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) | 支持构建、上传 Pages artifact 和部署；部署任务需要 `pages: write`、`id-token: write`，采用 `github-pages` environment | 构建与部署分离，PR 只验证；正式分支通过验收后发布 |
| S03 | [Vite：GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages) | 项目站点 `base` 为 `/<REPO>/`；根站点／自定义域名为 `/`；构建产物为 `dist` | base、manifest、SW scope、资源链接统一从部署基路径生成 |
| S04 | [MDN：Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) | Manifest、HTTPS、192／512 图标等安装条件；安装方式因平台不同；iOS 不支持自定义 `beforeinstallprompt` 流程 | 提供能力检测与平台安装说明；离线须另做 SW，不把安装视作缓存完成 |
| S05 | [MDN：Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) | SW 可缓存资源、拦截请求；不同缓存策略影响新旧资源；浏览器可终止后台 worker | 首次联网预缓存后才能保证离线；现场测量只在前台运行；更新不打断记录 |
| S06 | [MDN：DeviceOrientationEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent) | `alpha` 是绕 z 轴旋转角；有 `absolute` 标记；`webkitCompassHeading`、`webkitCompassAccuracy` 是非标准扩展；接口受安全上下文约束 | 不能用任意 `alpha` 充当北向；设计独立适配器、显示未知精度、实机对照验证 |
| S07 | [MDN：requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) | 部分实现需要权限；调用依赖用户点击等瞬时激活；API 支持并不统一 | 检测函数存在性，在启动测量按钮内申请；拒绝／异常／无数据时可手工测量 |
| S08 | [MDN：Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | IndexedDB／Cache 按 origin 管理配额；默认存储可能被回收；隐私窗口通常不保留；`persist()` 可能被拒绝；存在 `QuotaExceededError` | 本地保存状态明确；支持完整备份与恢复；同源不同项目命名隔离，不声称是安全隔离 |
| S09 | [NOAA NCEI：World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model) | WMM2025 于 2024-12-17 发布，有效至 2029 年底；磁偏角计算依赖经纬度、高度、日期；官方模型与源码说明为公有领域 | 首版仅支持人工填写有来源的磁偏角；自动 WMM 计算留待后续；不把一个地区的固定偏角用于全球 |
| S10 | [维基百科：罗庚／堪舆罗盘](https://zh.wikipedia.org/wiki/羅庚) | 给出八宫、每山十五度及完整角度表；区分三合、三元和综合罗盘 | 提供二十四山地盘正针基础表；百科为二手资料，正式内容需人工复核，不能据此包办流派算法 |
| S11 | [维基文库：《葬书》](https://zh.wikisource.org/wiki/葬書) | 页面包含版本介绍与署名争议说明，提供扫描来源索引；作品标示公有领域，页面编校内容另有网站许可 | 标为“传统题郭璞撰”，保存版本和章节，不把题署当成确定史实 |
| S12 | [维基文库：《葬书·内篇》](https://zh.wikisource.org/wiki/葬書/內篇) | “气乘风则散，界水则止”“得水为上，藏风次之”见内篇二；正文与注释并列，页面有明显录入疑点 | 可用于传统术语和形势记录背景，须分开原文／注释／现代解释；逐条对照扫描再正式收录 |
| S13 | [voidforall/fengshui.skill](https://github.com/voidforall/fengshui.skill) | 顾问技能、参考资料和对话示例；所见内容许可不明确，飞星参考表不覆盖完整 24 山 | 问询和报告结构参考；规则待复核 |
| S14 | [dglijin-oss：风水模块](https://github.com/dglijin-oss/chinese-metaphysics-skills/tree/main/fengshui-skill) | 模块有 MIT LICENSE；技能 v4.0.0 与代码版本不同，源码存在年份写死、游年表重复及声明／入口差异 | 作为二手代码参考，不直接引入；独立核验后才可复用 |
| S15 | [ar-gen-tin/fengshui](https://github.com/ar-gen-tin/fengshui) | 已归档；所查罗盘教学及综合典籍仅有占位文件，README 分类链接指向另一仓库 | 分类线索；套数和实际古籍文件未核实，不作为已获得资料 |

S13—S15 的“已核实”仅表示仓库与阅读内容已核查，不表示其算法／套数已确认。固定提交、具体缺陷及复用结论见 [仓库核查](github-repositories.md)。

## 研究结论与产品决策

1. **现场工作闭环**：建项目 → 明确观察对象和朝向线 → 选择读数来源／北向基准 → 多次测量 → 用户确认坐向 → 记录砂水及周边环境 → 叠加平面图 → 生成报告／备份。在线地图和 AI 不构成现场前置条件。
2. **二十四山可明确计算**：以北为 0°、顺时针；子山跨 0°；边界采用左闭右开。这一半开区间是本产品的工程约定，不能冒称古籍的精密标准。S10 提供方位表依据，具体公式见领域参考。
3. **专业性来自可复核的数据**：保存测点、对象、仪器／接口来源、时间、原始角度、参考北、磁偏角、质量状态、人工改动和规则版本。不要只存最终“某山某向”。
4. **明确流派层级**：首版只计算地盘正针；后天八卦用于方位分组；不会叠加天盘／人盘偏移，也不会默认分金、兼向阈值、替卦、宅命或飞星规则。
5. **磁偏角与测量噪声是不同问题**：磁偏角连接磁北与真北；钢筋、电器、手机壳磁铁造成的局部干扰不靠磁偏角修正解决。稳定读数也可能有系统误差。
6. **PWA 不保证仪器精度**：读数显示一位小数是显示分辨率；采样稳定性不是绝对精度。传感器能力必须经实机核验；实体罗盘手录可完成所有核心步骤。
7. **内容表达**：传统理论作为有出处的文化解释；现场可观察事实和人员判断分别标注；首版不计算财富、健康或命运预测。

## 来源使用与版权

- 技术文档以链接和原创中文摘要引用。开发时检查具体代码片段及依赖的许可，并保留必要署名。
- S10 的资料可作为核查入口；如复制／改写百科表达，须按 CC BY-SA 4.0 要求署名、注明修改并处理相同方式共享要求。首版以自行整理的数据和原创说明为主。
- S11／S12 的古籍原文与现代编校／注释／扫描图的权利不能混为一谈。只引用少量经核对的原文，保存书名、版本、章节、URL；不批量复制网页注释或扫描图。
- WMM 官方说明公有领域不自动覆盖任意第三方 JavaScript 实现。后续如引入算法包，另核对包的许可证、模型有效期和 NOAA 测试向量。
- S13 未见明确内容复用许可；S14 的 MIT 许可只按其风水模块范围记录，复用须保留版权及许可；S15 的学习研究声明不等于逐份现代课程或扫描图可再发布。仓库公开不自动意味着所有内容是开放许可。

## 待复核与未采用资料

- 搜索发现 eTop 工程科技推展平台的《風水羅盤之知識體系研究》PDF：本次只看到检索条目，未读取全文，不据其声明具体算法；后续内容审核可查作者、年度和原始出版信息。
- 中国哲学书电子化计划访问出现连接检查页，未获得可核实正文，未用作引用依据。
- 搜索摘要与 AI 概览不作为证据。概览出现“十天干＋十二地支＋四维卦构成二十四山”的错误：应为**八天干（不含戊己）＋十二地支＋四维卦**。
- 天盘／人盘偏移方向、三元龙阴阳、分金、玄空起运与替卦、八宅宅卦等尚未完成版本及流派核验。后续新增计算前须明确版本，取得人工审核和至少两组独立例盘；首版不依赖这些决定。

## 来源到规格的追踪

| 规格 | 资料依据 | 产品自行约定 |
| --- | --- | --- |
| `field-compass` | S06、S07、S09、S10 | 半开区间、北向状态、3 秒采样窗口、2° 边界提示 |
| `survey-workspace` | S11、S12（术语背景） | 多测点、朝向确认、观察／判断分开 |
| `plan-overlay` | S10（方位表） | 用户指定中心、图顶方位角、同一参考北 |
| `knowledge-library` | S10、S11、S12；S13—S15 为候选线索 | 内容审核状态、固定仓库提交、来源资格、规则集版本、离线解释 |
| `local-data-reports` | S08、S01 | 本地备份、脱敏导出、历史快照 |
| `offline-pwa` | S04、S05、S08 | 明示离线就绪、延后激活更新 |
| `github-pages-hosting` | S01、S02、S03 | Hash 路由、项目路径和根路径双验收 |
