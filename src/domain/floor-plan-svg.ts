import { openingGeometry, type FloorPlan } from "./floor-plan";
import type { QiFinding } from "./indoor-qi";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function floorPlanSVG(plan: FloorPlan, findings: QiFinding[] = []) {
  const margin = 0.6;
  const rooms = plan.rooms
    .map(
      (r) =>
        `<g><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#eff2e8" stroke="#34513e" stroke-width=".05"/><text x="${r.x + r.width / 2}" y="${r.y + r.height / 2}" text-anchor="middle" fill="#1f3528" font-size=".3">${escape(r.name)}</text><text x="${r.x + r.width / 2}" y="${r.y + r.height / 2 + 0.35}" text-anchor="middle" fill="#4b5b51" font-size=".2">${r.width}×${r.height}m</text></g>`,
    )
    .join("");
  const openings = plan.openings
    .map((o) => {
      const { start, end, center } = openingGeometry(plan, o);
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="white" stroke-width=".1"/><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${o.kind === "window" ? "#29738b" : o.entrance ? "#a35436" : "#287551"}" stroke-width=".065"/>${o.entrance ? `<text x="${center.x}" y="${center.y + 0.3}" text-anchor="middle" fill="#8d3e23" font-size=".24">入口</text>` : ""}`;
    })
    .join("");
  const obstacles = plan.obstacles
    .map(
      (o) =>
        `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#b8ae9a" stroke="#74674f" stroke-width=".03"/><text x="${o.x + o.width / 2}" y="${o.y + o.height / 2}" text-anchor="middle" font-size=".2">${escape(o.name)}</text>`,
    )
    .join("");
  const lines = findings
    .filter((f) => f.line)
    .map(
      (f) =>
        `<line x1="${f.line!.from.x}" y1="${f.line!.from.y}" x2="${f.line!.to.x}" y2="${f.line!.to.y}" stroke="#b75237" stroke-width=".06" stroke-dasharray=".16 .1"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width * 80 + 96}" height="${plan.height * 80 + 96}" viewBox="-${margin} -${margin} ${plan.width + margin * 2} ${plan.height + margin * 2}" font-family="sans-serif"><rect x="-.6" y="-.6" width="${plan.width + 1.2}" height="${plan.height + 1.2}" fill="white"/><rect x="0" y="0" width="${plan.width}" height="${plan.height}" fill="#fff" stroke="#66796d" stroke-width=".04"/>${rooms}${obstacles}${openings}${lines}<text x="${plan.width / 2}" y="-.2" text-anchor="middle" fill="#3c5746" font-size=".22">${plan.width}m · 图顶${plan.topAngle == null ? "方向未设置" : ` ${plan.topAngle}°`}</text></svg>`;
}
export async function floorPlanPNG(plan: FloorPlan) {
  const svg = floorPlanSVG(plan);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法生成户型图");
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("生成 PNG 失败"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
