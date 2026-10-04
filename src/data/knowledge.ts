import { interval, MOUNTAINS, RULE_VERSION } from "../domain/direction";
export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  license: string;
  acquired: string;
  review: string;
  author?: string;
  acquiredAt?: string;
  contentVersion?: string;
  section?: string;
  commit?: string;
  path?: string;
}
export const SOURCES: SourceRecord[] = [
  {
    id: "project",
    title: "本项目方向与现场记录约定",
    url: "https://github.com/unknownparticles/fengshui",
    license: "本项目原创说明",
    acquired: "已整理",
    review: "工程规则已核验",
  },
  {
    id: "S10",
    title: "罗庚 · 二十四山方向表",
    url: "https://zh.wikipedia.org/wiki/羅庚",
    license: "CC BY-SA 4.0；本应用使用原创说明",
    acquired: "已查阅",
    review: "方向表已对照",
  },
  {
    id: "S11",
    title: "《葬书》版本及题署说明",
    url: "https://zh.wikisource.org/wiki/葬書",
    license: "古籍与编校权利须分别核对",
    acquired: "网页已查阅",
    review: "扫描原文待复核",
  },
  {
    id: "S12",
    title: "《葬书·内篇》",
    url: "https://zh.wikisource.org/wiki/葬書/內篇",
    license: "古籍与编校权利须分别核对",
    acquired: "网页已查阅",
    review: "扫描原文待复核",
  },
  {
    id: "S13",
    title: "堪舆子顾问技能",
    url: "https://github.com/voidforall/fengshui.skill",
    license: "复用许可未确认",
    acquired: "已静态核查",
    review: "规则冲突待复核",
    commit: "91762ccda4ea106260ff43f336df14adf08ae57d",
    path: "SKILL.md",
  },
  {
    id: "S14",
    title: "风水堪舆技能模块",
    url: "https://github.com/dglijin-oss/chinese-metaphysics-skills",
    license: "风水模块 MIT 已确认",
    acquired: "已静态核查",
    review: "版本及算法问题待复核",
    commit: "2542ead6adb2fac1807e8eb801a95e39409cfeed",
    path: "fengshui-skill/SKILL.md",
  },
  {
    id: "S15",
    title: "风水书目分类线索",
    url: "https://github.com/ar-gen-tin/fengshui",
    license: "未确认资料再发布授权",
    acquired: "课程实际文件未获取",
    review: "仅分类线索",
    commit: "49c6e4656fe6673e86156f7d50675e7832c5d2e6",
    path: "README.md",
  },
];
export interface Entry {
  id: string;
  title: string;
  category: string;
  text: string;
  version: string;
  sourceIds: string[];
  status: "approved" | "candidate";
}
const base = (
  id: string,
  title: string,
  category: string,
  text: string,
  sourceIds = ["project"],
): Entry => ({
  id,
  title,
  category,
  text,
  sourceIds,
  version: "field-reference-v1",
  status: "approved",
});
SOURCES.forEach((source) => {
  source.acquiredAt = "2026-10-04";
  source.contentVersion = source.commit || "field-reference-v1";
  source.author =
    source.id === "project"
      ? "本项目整理"
      : source.id === "S11" || source.id === "S12"
        ? "传统题郭璞撰"
        : source.id === "S10"
          ? "维基百科贡献者"
          : "对应仓库维护者";
  source.section = source.path || source.title;
});
export const KNOWLEDGE: Entry[] = [
  base(
    "workflow",
    "现场测量流程",
    "现场",
    "先建立项目和测点，明确测的是建筑轴线、门向或其他对象。选择参考北，保存至少三次独立测量。复测一致后确认取向依据，再记录现场观察、图纸与报告。",
  ),
  base(
    "compass",
    "罗盘与地盘正针",
    "基础",
    "本工具启用地盘正针二十四山。实体罗盘读数可以手工录入；手机精度和参考北必须经过实机核验。数字的小数位是显示分辨率，稳定性也不能代替绝对精度。",
  ),
  base(
    "facing",
    "坐与向",
    "基础",
    "向是所观察朝向的方位，坐与向相差 180°。门向、窗口方向和建筑轴线分别记录，不能默认将门向当成建筑坐向。",
  ),
  base(
    "north",
    "磁北与真北",
    "测量",
    "磁北与真北采用不同北向基准。磁偏角以东偏为正，真北角等于磁北角加磁偏角后归一化。换算需要来源、适用日期和地点；局部金属干扰不能靠偏角换算消除。",
  ),
  base(
    "bagua",
    "后天八卦方位",
    "基础",
    "坎北、艮东北、震东、巽东南、离南、坤西南、兑西、乾西北。本项目采用后天方位，图纸上的北向位置由用户设置的图顶角决定。",
    ["S10", "project"],
  ),
  base(
    "boundary",
    "山界与复测",
    "测量",
    "每山占 15°。角度距最近山界不超过 2°时提示复测，列出相邻两山。此提示是工程约定，不是流派兼向、替卦或吉凶判定。",
  ),
  ...MOUNTAINS.map((m) => ({
    ...base(
      m.name === "子" ? "zi" : `mountain-${m.index}`,
      `${m.name}山 · ${m.direction}方`,
      "二十四山",
      `中心角 ${m.center}°；区间 ${interval(m.center)}；对山 ${m.opposite}；后天 ${m.palace}宫。区间左闭右开，按未舍入角度分类。`,
      ["S10", "project"],
    ),
    version: RULE_VERSION,
  })),
  ...[
    ["龙", "观察地形的延续、来势与走向"],
    ["砂", "记录周边山体、建筑与遮挡"],
    ["水", "记录水流、沟渠、来水与去水的现场事实"],
    ["穴", "记录人员选定的观察或中心位置"],
    ["向", "明确所采用方向及取向依据"],
    ["明堂", "记录观察位置前方空间和周边形势"],
  ].map(([title, text]) =>
    base(
      `term-${title}`,
      title,
      "术语",
      `${text}。本工具用于分类记录，现场事实、传统解释与人员判断分别呈现，不自动断吉凶。`,
    ),
  ),
  base(
    "extensions",
    "其他盘层与流派",
    "扩展",
    "天盘、人盘、分金、玄空飞星和八宅属于后续独立规则集，首版未启用计算。参考资料不能改变当前地盘方向规则。",
  ),
  {
    id: "classics",
    title: "古籍原文待复核",
    category: "参考线索",
    text: "传统题郭璞撰的《葬书》存在版本与题署问题。本应用暂不收录尚未对照扫描的古籍原文及现代注释。",
    version: "candidate-v1",
    sourceIds: ["S11", "S12"],
    status: "candidate",
  },
  ...SOURCES.filter((s) => ["S13", "S14", "S15"].includes(s.id)).map((s) => ({
    id: `source-${s.id}`,
    title: s.title,
    category: "参考线索",
    text: `${s.acquired}；${s.license}；${s.review}。仅提供参考线索，不启用自动解释。`,
    version: s.commit!,
    sourceIds: [s.id],
    status: "candidate" as const,
  })),
];
