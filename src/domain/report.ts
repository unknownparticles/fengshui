import { KNOWLEDGE, SOURCES } from "../data/knowledge";
import {
  mountain,
  MOUNTAINS,
  NORTH_LABEL,
  opposite,
  RULE_VERSION,
} from "./direction";
import {
  DEFAULT_PRIVACY,
  facingAngle,
  nowISO,
  snapshot,
  timezone,
  uid,
  type Overlay,
  type Privacy,
  type Project,
  type Report,
  type Attachment,
} from "./model";
import { imageDataURL } from "./images";
export function createReport(
  project: Project,
  privacy: Privacy = DEFAULT_PRIVACY,
): Report {
  const ids = new Set(project.observations.map((o) => o.knowledgeId));
  const knowledge = KNOWLEDGE.filter(
    (k) => ids.has(k.id) && k.status === "approved",
  ).map((k) => ({
    id: k.id,
    title: k.title,
    version: k.version,
    text: k.text,
    sourceIds: [...k.sourceIds],
  }));
  const sourceIds = new Set(knowledge.flatMap((k) => k.sourceIds));
  return {
    id: uid(),
    createdAt: nowISO(),
    timezone: timezone(),
    appVersion: "0.1.0",
    ruleVersion: RULE_VERSION,
    privacy: { ...privacy },
    snapshot: snapshot(project),
    knowledge,
    sources: structuredClone(SOURCES.filter((s) => sourceIds.has(s.id))),
  };
}
export const escapeHTML = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function overlaySVG(image: Attachment, overlay: Overlay): string {
  const cx = overlay.center.x * image.width,
    cy = overlay.center.y * image.height,
    r = Math.hypot(image.width, image.height);
  const count = overlay.mode === "eight" ? 8 : 24;
  const labels =
    overlay.mode === "eight"
      ? ["北", "东北", "东", "东南", "南", "西南", "西", "西北"]
      : MOUNTAINS.map((m) => m.name);
  const ray = (degrees: number, radius: number) => {
    const angle = ((degrees - overlay.topAngle) * Math.PI) / 180;
    return [cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius];
  };
  const radius = Math.min(image.width, image.height) * 0.32;
  let shapes = "";
  for (let i = 0; i < count; i++) {
    const [a, b] = ray(
      (i * 360) / count - (overlay.mode === "eight" ? 22.5 : 7.5),
      r,
    );
    const [x, y] = ray((i * 360) / count, radius);
    shapes += `<line x1="${cx}" y1="${cy}" x2="${a}" y2="${b}" stroke="#225C47" stroke-width="${Math.max(1, image.width / 700)}"/><text x="${x}" y="${y}" fill="#173B2B" stroke="white" stroke-width="${image.width / 900}" paint-order="stroke" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.max(12, image.width / 35)}">${labels[i]}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}"><image href="${imageDataURL(image)}" width="${image.width}" height="${image.height}"/><g opacity="${overlay.opacity}">${shapes}<circle cx="${cx}" cy="${cy}" r="${Math.max(4, image.width / 120)}" fill="#225C47" stroke="white"/></g></svg>`;
}
export function reportHTML(
  report: Report,
  privacy: Privacy = report.privacy,
): string {
  const p = report.snapshot;
  const e = escapeHTML;
  const a = p.adoptions.find((a) => a.id === p.activeAdoptionId);
  const measurements = p.measurements
    .map(
      (m) =>
        `<tr><td>${e(p.points.find((pt) => pt.id === m.pointId)?.name)}</td><td>${e(m.object)}<br/>${e(m.kind === "facing" ? "测向" : "测坐")}</td><td>${m.rawAngle}° ${e(NORTH_LABEL[m.rawNorth])}<br/>${e(m.source)}${m.calibration ? `<br/>人工参考校准：${e(m.calibration.source)}；参考角 ${m.calibration.referenceAngle}°；原始锚点 ${m.calibration.rawAnchor}°；偏移 ${m.calibration.offset}°；${e(m.calibration.createdAt)}` : ""}</td><td>${m.angle}° ${e(NORTH_LABEL[m.north])}<br/>向${e(mountain(facingAngle(m)).name)}</td><td>${e(m.quality.status)}<br/>样本 ${m.quality.count}，离散度 ${m.quality.spread ?? "未知"}°<br/>精度 ${m.quality.accuracy ?? "未知"}</td><td>${e(m.createdAt)}<br/>${e(m.timezone)}<br/>${e(m.ruleVersion)}${m.correction ? `<br/>人工磁偏角 ${m.correction.degrees}°，${e(m.correction.source)}，${e(m.correction.date)}，${e(privacy.location ? m.correction.place : "地点已省略")}` : ""}</td></tr>`,
    )
    .join("");
  const observations = p.observations
    .map(
      (o) =>
        `<section class="observation"><h3>${e(o.category)} · ${e(p.points.find((pt) => pt.id === o.pointId)?.name)}</h3><p><strong>事实：</strong>${e(o.fact || "未记录")}</p><p><strong>人员判断：</strong>${e(o.judgment || "未记录")}</p><p>观察时间：${e(o.updatedAt)}${o.direction != null ? `；方位 ${o.direction}° ${e(NORTH_LABEL[o.north!])}` : ""}</p>${
          privacy.photos
            ? o.attachmentIds
                .map((id) => {
                  const img = p.attachments.find((x) => x.id === id);
                  return img
                    ? `<img alt="现场照片" class="photo" src="${imageDataURL(img)}"/>`
                    : "";
                })
                .join("")
            : ""
        }${o.knowledgeId ? `<p>关联资料 ${e(o.knowledgeId)} · ${e(o.knowledgeVersion)}</p>` : ""}</section>`,
    )
    .join("");
  const overlays = p.overlays
    .filter(
      (o, i, all) =>
        !all.slice(i + 1).some((x) => x.attachmentId === o.attachmentId),
    )
    .map((o) => {
      const image = p.attachments.find((x) => x.id === o.attachmentId);
      return image
        ? `<section><h3>人工中心方位示意</h3><p>图顶 ${o.topAngle}° · ${e(NORTH_LABEL[o.north])} · ${o.adoptionId && o.adoptionId === p.activeAdoptionId ? "已关联采用坐向" : p.activeAdoptionId ? "待复核" : "尚未采用建筑坐向"} · ${e(o.ruleVersion)}</p>${overlaySVG(image, o)}</section>`
        : "";
    })
    .join("");
  return `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(p.name)} · 现场堪舆报告</title><style>body{font-family:system-ui,sans-serif;color:#17251e;background:#fff;max-width:1100px;margin:32px auto;padding:0 24px;line-height:1.7}h1{font-size:28px}h2{border-bottom:1px solid #8d9c93;padding-bottom:8px;margin-top:32px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #86958b;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}.meta{font-size:12px;color:#46594e}.observation{border-left:3px solid #225c47;padding-left:16px;margin:24px 0}.photo{max-width:360px;max-height:300px}svg{display:block;width:100%;max-height:700px}section{break-inside:avoid}thead{display:table-header-group}@media print{body{margin:0;padding:0;font-size:11pt}@page{size:A4;margin:16mm}tr,img{break-inside:avoid}table{font-size:9px}svg{max-height:550px}}</style></head><body><p class="meta">堪舆手记 · 现场报告</p><h1>${e(p.name)}</h1><p class="meta">生成 ${e(report.createdAt)} · 时区 ${e(report.timezone)}<br/>应用 ${e(report.appVersion)} · 规则 ${e(report.ruleVersion)} · 报告 ${e(report.id)}</p><p class="meta">省略字段：${[!privacy.location ? "详细地址" : "", !privacy.coordinates ? "坐标" : "", !privacy.photos ? "照片" : ""].filter(Boolean).join("、") || "未省略"}</p>${privacy.location ? `<p>地点：${e(p.location || "未记录")}</p>` : ""}${privacy.coordinates ? `<p>坐标：${e(p.latitude ?? "未记录")}，${e(p.longitude ?? "未记录")}</p>` : ""}<h2>采用坐向与依据</h2>${a ? `<p><strong>坐${e(mountain(opposite(a.angle)).name)}向${e(mountain(a.angle).name)} · 向角 ${a.angle}° · ${e(NORTH_LABEL[a.north])}</strong></p><p>取向依据：${e(a.basis)}<br/>确认方式：${a.manual ? "人工选值" : "复测均值确认"}<br/>修订原因：${e(a.reason || "未记录")}<br/>关联测量：${e(a.measurementIds.join("、"))}</p>` : "<p>未确认坐向 · 待复核</p>"}<h2>测点与原始测量</h2><table><thead><tr><th>测点</th><th>对象</th><th>原始读数</th><th>输出</th><th>质量</th><th>时间与来源</th></tr></thead><tbody>${measurements || '<tr><td colspan="6">未记录</td></tr>'}</tbody></table><h2>坐向修订</h2>${p.adoptions.map((r) => `<p>${r.angle}° · ${e(NORTH_LABEL[r.north])} · ${e(r.createdAt)}<br/>${e(r.basis)} · ${e(r.reason || "复测均值确认")} · ${e(r.id)}</p>`).join("") || "<p>未记录</p>"}<h2>现场观察与人员判断</h2>${observations || "<p>未记录</p>"}<h2>平面图方位示意</h2>${overlays || "<p>未记录</p>"}<h2>关联资料与版本</h2>${report.knowledge.map((k) => `<section><h3>${e(k.title)} · ${e(k.version)}</h3><p>原创说明：${e(k.text)}</p></section>`).join("") || "<p>未关联资料</p>"}${report.sources.map((s) => `<p class="meta">${e(s.title)} · ${e(s.url)}<br/>${e(s.license)} · ${e(s.contentVersion)} · ${e(s.commit || "")} · ${e(s.path || "")}</p>`).join("")}<p class="meta">本报告为生成时的资料快照，后续项目编辑不会改变此报告。现场事实、传统解释与人员判断分别记录。</p></body></html>`;
}
