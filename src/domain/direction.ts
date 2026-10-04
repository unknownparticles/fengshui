export const RULE_VERSION = "earth-plate-v1";
export type North = "magnetic" | "true" | "unknown";
export type KnownNorth = Exclude<North, "unknown">;
export const NORTH_LABEL: Record<North, string> = {
  magnetic: "磁北",
  true: "真北",
  unknown: "北向未知",
};
const names = [
  "子",
  "癸",
  "丑",
  "艮",
  "寅",
  "甲",
  "卯",
  "乙",
  "辰",
  "巽",
  "巳",
  "丙",
  "午",
  "丁",
  "未",
  "坤",
  "申",
  "庚",
  "酉",
  "辛",
  "戌",
  "乾",
  "亥",
  "壬",
];
const palaces = ["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"];
const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
export const MOUNTAINS = names.map((name, index) => ({
  name,
  index,
  center: index * 15,
  palace: palaces[Math.floor((index + 1) / 3) % 8],
  direction: directions[Math.floor((index + 1) / 3) % 8],
  opposite: names[(index + 12) % 24],
}));
export function normalize(angle: number): number {
  if (!Number.isFinite(angle)) throw new Error("角度必须为有限数值");
  return ((angle % 360) + 360) % 360;
}
export function parseAngle(text: string): number {
  if (!text.trim()) throw new Error("请填写 0° 至 360° 的方向");
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 360)
    throw new Error("方向须在 0° 至 360° 之间");
  return normalize(value);
}
export const signedDelta = (from: number, to: number) =>
  normalize(to - from + 180) - 180;
export const opposite = (angle: number) => normalize(angle + 180);
export const mountain = (angle: number) =>
  MOUNTAINS[Math.floor((normalize(angle) + 7.5) / 15) % 24];
export function interval(angle: number): string {
  const m = mountain(angle);
  return m.index === 0
    ? "[352.5°, 360°) ∪ [0°, 7.5°)"
    : `[${m.center - 7.5}°, ${m.center + 7.5}°)`;
}
export function boundary(angle: number) {
  let best = { distance: Infinity, left: "", right: "", angle: 0 };
  for (let index = 0; index < 24; index++) {
    const edge = 7.5 + 15 * index;
    const distance = Math.abs(signedDelta(angle, edge));
    if (distance < best.distance)
      best = {
        distance,
        angle: edge,
        left: names[index],
        right: names[(index + 1) % 24],
      };
  }
  return best;
}
export interface Declination {
  degrees: number;
  source: string;
  date: string;
  place: string;
}
export function convertNorth(
  angle: number,
  from: North,
  to: North,
  correction?: Declination,
): number {
  if (from === "unknown" || to === "unknown")
    throw new Error("北向基准未知，不能换算");
  if (from === to) return normalize(angle);
  if (
    !correction ||
    !Number.isFinite(correction.degrees) ||
    Math.abs(correction.degrees) > 180 ||
    !correction.source.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(correction.date) ||
    !correction.place.trim()
  ) {
    throw new Error("换算须填写有效磁偏角、来源、适用日期及地点");
  }
  return normalize(
    angle + (from === "magnetic" ? correction.degrees : -correction.degrees),
  );
}
export function circularMean(angles: number[]) {
  if (!angles.length) return { angle: null, strength: 0, spread: Infinity };
  const radians = angles.map((a) => (normalize(a) * Math.PI) / 180);
  const x = radians.reduce((a, b) => a + Math.cos(b), 0) / angles.length;
  const y = radians.reduce((a, b) => a + Math.sin(b), 0) / angles.length;
  const strength = Math.hypot(x, y);
  if (strength < 0.1) return { angle: null, strength, spread: Infinity };
  const angle = normalize((Math.atan2(y, x) * 180) / Math.PI);
  return {
    angle,
    strength,
    spread: Math.max(...angles.map((a) => Math.abs(signedDelta(angle, a)))),
  };
}
export function coveringArc(angles: number[]): number {
  if (angles.length < 2) return 0;
  const sorted = angles.map(normalize).sort((a, b) => a - b);
  const gaps = sorted.map(
    (value, i) =>
      (i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1]) - value,
  );
  return 360 - Math.max(...gaps);
}
export const QUALITY_VERSION = "field-quality-v1";
export interface Sample {
  angle: number;
  at: number;
  beta: number | null;
  gamma: number | null;
  north: North;
  portrait: boolean;
  accuracy: number | null;
  source: string;
}
export function sampleQuality(samples: Sample[], now: number, started: number) {
  const window = samples
    .filter(
      (s) => s.at >= now - 3000 && s.at <= now && Number.isFinite(s.angle),
    )
    .slice(-300);
  const last = window.at(-1);
  const mean = circularMean(window.map((s) => s.angle));
  const accuracy =
    last?.accuracy != null &&
    Number.isFinite(last.accuracy) &&
    last.accuracy >= 0
      ? last.accuracy
      : null;
  let status = "可锁定";
  if (!last) status = "等待方向数据";
  else if (now - last.at > 2000) status = "方向数据已过期，请重新测量";
  else if (
    window.some((s) => s.north === "unknown") ||
    new Set(window.map((s) => s.north)).size > 1
  )
    status = "北向基准未知，建议手录";
  else if (
    window.some(
      (s) =>
        !s.portrait ||
        s.beta == null ||
        s.gamma == null ||
        Math.abs(s.beta) > 15 ||
        Math.abs(s.gamma) > 15,
    )
  )
    status = "请竖屏平放手机";
  else if (accuracy != null && accuracy > 5)
    status = "设备报告低精度，建议手录";
  else if (now - started < 3000 || window.length < 10)
    status = "采样中，至少需要 3 秒和 10 个样本";
  else if (mean.angle == null || mean.spread > 3) status = "读数不稳定，请复测";
  return {
    status,
    stable: status === "可锁定",
    count: window.length,
    accuracy,
    ...mean,
    samples: window,
    version: QUALITY_VERSION,
  };
}
