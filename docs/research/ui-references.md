# UI 参考核查

日期：2026-10-04（Asia/Shanghai）。本次阅读两个 GitHub 仓库的相关文档／文件和 Roxy UI 文档、许可及实时预览，并查看排盘截图。未运行这些项目，也未安装组件；“界面可参考”不代表算法、实机兼容性或离线行为已验证。

## 核查结果

| 编号 | 参考 | 已核实内容 | 本项目采用方式 |
| --- | --- | --- | --- |
| S16 | [zhaoolee/cyber-fortune-telling](https://github.com/zhaoolee/cyber-fortune-telling) | frontend/package.json 有 Next 15.1.9、React ^19.0.1、MUI ^7.1.0、Framer Motion ^12.9.4；README 介绍响应式、多主题、PWA，并依赖 Strapi／数据库／AI 服务 | 参考主题切换和数据卡片结构；首版保持现有 Vite 静态架构，页面状态围绕现场采集 |
| S17 | [deeptexas-ai/Zhouyi-Bagua-Divination-Source-Code](https://github.com/deeptexas-ai/Zhouyi-Bagua-Divination-Source-Code) | 有 index.html／index.js、截图与资料页；四柱截图采用时间／时区摘要、大字号关键值和密集表格；README 明确部分 UI 调用 /api，完整依赖未齐 | 参考“输入摘要—关键值—分组结果—原始记录”层次；手机端把密集表格改成摘要卡和详情视图 |
| S18 | [Roxy UI 文档](https://roxyapi.com/blogs/roxy-ui-astrology-vedic-tarot-web-components)、[源码](https://github.com/RoxyAPI/ui)、[预览](https://roxyapi.github.io/ui/) | 风水筛选实际展示飞星、流年飞星、命卦等 4 个预览；`roxy-flying-star-chart` 为九宫，`roxy-kua-card` 为命卦八方；支持主题变量、part、数据与解释分块 | 参考主题 token、图形图例、文字详情的组件边界；首版罗盘自行实现 SVG 二十四山，不把结果组件当采样仪器 |

S16 的 ThemeSelector.js 当前只启用“瓷白”和“墨黑”；天蓝、青绿、赤红、金黄、胭脂选项被注释。因此不能把 README 的多主题描述理解为所有中国传统色方案已在此选择器开放。

S17 的截图可证明视觉布局，不证明每个截图对应完整公开的可执行排盘模块。其 License.md 含 MIT 正文，也追加商用授权联系和 All Rights Reserved 表述；直接复制前须厘清具体文件及第三方权利。本项目采用原创布局，不复制截图资产或业务实现。

## 文件与版本定位

| 参考 | 核查时首页提交 | 重点文件 |
| --- | --- | --- |
| S16 | `9a7ace81f9151d3055f66dcd5e977f0ac09eb2d6` | [依赖清单](https://github.com/zhaoolee/cyber-fortune-telling/blob/9a7ace81f9151d3055f66dcd5e977f0ac09eb2d6/frontend/package.json)、[主题选择器](https://github.com/zhaoolee/cyber-fortune-telling/blob/9a7ace81f9151d3055f66dcd5e977f0ac09eb2d6/frontend/components/ThemeSelector.js)、README |
| S17 | `14fc6c43898800120b052825d8ba63febac1987d` | [许可](https://github.com/deeptexas-ai/Zhouyi-Bagua-Divination-Source-Code/blob/14fc6c43898800120b052825d8ba63febac1987d/License.md)、[四柱截图](https://github.com/deeptexas-ai/Zhouyi-Bagua-Divination-Source-Code/blob/14fc6c43898800120b052825d8ba63febac1987d/docs/assets/screenshots/wujibazi.png)、README |
| S18 | `4a6402570d2cad8de39507ea079970b9083b2d63` | [MIT LICENSE](https://github.com/RoxyAPI/ui/blob/4a6402570d2cad8de39507ea079970b9083b2d63/LICENSE)、README；文档及实时预览单独按核查日期记录 |

S16 README 声称 MIT，但所查根目录文件列表未见 LICENSE；本次未确认完整许可文件，代码复制状态保持待核对。S18 MIT 正文要求保留版权和许可，不能照搬其博客“无署名要求”一语作为免除许可证保留的依据。

## Roxy UI 适配边界

- 文档与预览已确认有风水组件；没有足够证据支持“唯一相关选择”的市场比较断言。
- 飞星九宫与命卦方位是排盘结果视图，不等于完整地盘二十四山、磁北读数、姿态检测、山界提示或复测记录。API 示例中的 S2／N2 不能未经规则转换替代本项目午／子等山名。
- 九宫预览采用南在上、北在下；本项目现场罗盘以方向模型驱动，平面图以用户图顶角驱动。不能因外观相似而继承另一种图向约定；任何后续九宫显示都须标方向。
- README 表明中文响应可按简／繁脚本返回，而组件标签仍为英文；预览语言选择没有中文。中文产品不能只设置 lang 就认定已完成本地化。
- README 描述 React／Vue 包的组件从 CDN 加载。首版如后续尝试采用，必须先核实实现、固定版本并本地打包，通过断网冷启动、中文和打印验收；当前不引入该依赖，也不使用 `@latest` 运行时脚本。
- 组件 data 展示与取数不同：单纯显示已有数据可以不要求 API，widget 自动取数和 API SDK 示例则包含网络及密钥流程。当前 PWA 核心无需该取数服务，不能将 API 数据计算正确性由 UI 预览反推为已验证。
- 源码 README 说明 `hide-readings` 移除解释内容，而 `hide-sections` 隐藏结构块但可能保留 DOM 内容；CSS 隐藏不构成脱敏。报告敏感信息须从输出数据中省略。

## 用户提供但尚未独立核实的案例

| 名称 | 用户描述 | 本次状态 |
| --- | --- | --- |
| 羅盤排盤 - 蒼穹玄空大卦、AI堪輿師 | 黑金风格，应用商店成品 | 未提供具体商店链接，本次未核实对应版本、截图与仓库情况；只作为风格线索 |
| QiVision | 极简禅意，Devpost 项目 | 未提供具体项目页，本次未独立确认其技术栈和源码是否公开 |
| Qidar | 户型分析及 3D 评分，Devpost 项目 | 未提供具体项目页，本次未独立确认实现；3D 与评分不进入本项目首版 |

“没有找到源码”与“确定没有公开源码”不同。上述案例可在获得具体页面后追加核查，不据名称自行引用图片或复制界面。

## 设计采用结果

首版采用瓷白／墨黑两种主题、少量铜金强调、清晰罗盘与分组记录。现场测量主屏优先大字号角度和质量状态；图例、来源和原始记录通过可点击且可键盘操作的详情展开。具体页面、token、状态及验收见 [UI 设计约定](../design/ui-guidelines.md)。
