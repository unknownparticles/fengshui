import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { checkImage } from "./images";
import {
  SCHEMA_VERSION,
  OBJECTS,
  uid,
  type Project,
  type ProjectSnapshot,
  type Workspace,
  type Attachment,
} from "./model";
import { RULE_VERSION, convertNorth } from "./direction";
export const BACKUP_LIMITS = {
  compressed: 100 * 1024 * 1024,
  expanded: 250 * 1024 * 1024,
  attachments: 200,
  files: 202,
};
interface FileRecord {
  path: string;
  size: number;
  sha256: string;
}
interface Manifest {
  type: "fengshui-complete-backup";
  schemaVersion: number;
  appVersion: string;
  ruleVersion: string;
  exportedAt: string;
  files: FileRecord[];
}
const hash = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const idOK = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function safeJSON(bytes: Uint8Array): unknown {
  demand(bytes.length <= 10 * 1024 * 1024, "备份文本文件过大");
  return JSON.parse(strFromU8(bytes), (key, value) => {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("备份包含不安全字段");
    return value;
  });
}
export async function createBackup(workspace: Workspace): Promise<Uint8Array> {
  const files: Zippable = {};
  const projects = structuredClone(workspace.projects);
  const seen = new Map<string, Attachment>();
  const detach = (snapshot: ProjectSnapshot) => {
    snapshot.attachments.forEach((a) => {
      demand(idOK(a.id), "附件标识不合法");
      const prior = seen.get(a.id);
      if (prior) {
        demand(
          prior.bytes.length === a.bytes.length &&
            prior.bytes.every((b, i) => b === a.bytes[i]),
          "相同附件标识内容不同",
        );
      } else seen.set(a.id, { ...a, bytes: new Uint8Array(a.bytes) });
      delete (a as Partial<Attachment>).bytes;
    });
  };
  projects.forEach((p) => {
    detach(p);
    p.reports.forEach((r) => detach(r.snapshot));
  });
  demand(
    seen.size <= BACKUP_LIMITS.attachments,
    "备份附件超过 200 个，请拆分项目备份",
  );
  // 分离后的对象仍需从原始工作区读取二进制，避免删除共享副本中的 bytes。
  const originals = new Map<string, Attachment>();
  workspace.projects.forEach((p) => {
    p.attachments.forEach((a) => originals.set(a.id, a));
    p.reports.forEach((r) =>
      r.snapshot.attachments.forEach((a) => originals.set(a.id, a)),
    );
  });
  files["projects.json"] = strToU8(JSON.stringify(projects));
  for (const id of seen.keys()) {
    const a = originals.get(id)!;
    checkImage(a.bytes);
    files[`attachments/${id}.png`] = a.bytes;
  }
  const records: FileRecord[] = [];
  let total = 0;
  for (const [path, value] of Object.entries(files)) {
    const bytes = value as Uint8Array;
    total += bytes.length;
    records.push({ path, size: bytes.length, sha256: await hash(bytes) });
  }
  demand(total <= BACKUP_LIMITS.expanded, "备份展开体积超过 250 MiB");
  const manifest: Manifest = {
    type: "fengshui-complete-backup",
    schemaVersion: SCHEMA_VERSION,
    appVersion: "0.1.0",
    ruleVersion: RULE_VERSION,
    exportedAt: new Date().toISOString(),
    files: records,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const result = zipSync(files, { level: 6 });
  demand(result.length <= BACKUP_LIMITS.compressed, "备份压缩体积超过 100 MiB");
  return result;
}
export function validateSnapshot(p: ProjectSnapshot) {
  demand(
    idOK(p.id) &&
      typeof p.name === "string" &&
      p.name.trim() &&
      typeof p.location === "string",
    "项目字段不合法",
  );
  for (const field of [
    "points",
    "measurements",
    "adoptions",
    "observations",
    "attachments",
    "overlays",
  ] as const)
    demand(Array.isArray(p[field]), "项目数据不完整");
  demand(p.points.length > 0, "项目至少须有一个测点");
  const ids = new Set<string>();
  for (const list of [
    p.points,
    p.measurements,
    p.adoptions,
    p.observations,
    p.attachments,
    p.overlays,
  ])
    for (const item of list) {
      demand(idOK(item.id) && !ids.has(item.id), "项目标识重复或不合法");
      ids.add(item.id);
    }
  const points = new Set(p.points.map((x) => x.id));
  const measurements = new Set(p.measurements.map((x) => x.id));
  const attachments = new Set(p.attachments.map((x) => x.id));
  const adoptions = new Set(p.adoptions.map((x) => x.id));
  p.points.forEach((pt) =>
    demand(
      typeof pt.name === "string" &&
        OBJECTS.includes(pt.object) &&
        typeof pt.description === "string",
      "测点字段不合法",
    ),
  );
  p.measurements.forEach((m) => {
    if (m.calibration) {
      const c = m.calibration;
      demand(
        idOK(c.id) &&
          finite(c.rawAnchor, 0, 359.99999999999994) &&
          finite(c.referenceAngle, 0, 359.99999999999994) &&
          finite(c.offset, 0, 359.99999999999994) &&
          c.north === m.rawNorth &&
          typeof c.source === "string" &&
          c.source.trim() &&
          typeof c.adapter === "string" &&
          Number.isFinite(Date.parse(c.createdAt)),
        "人工校准参数不合法",
      );
      demand(
        Math.abs(((c.referenceAngle - c.rawAnchor + 360) % 360) - c.offset) <
          1e-8,
        "校准偏移与参考角度不一致",
      );
    }
    demand(
      points.has(m.pointId) &&
        OBJECTS.includes(m.object) &&
        ["facing", "sitting"].includes(m.kind),
      "测量引用或对象不合法",
    );
    demand(
      finite(m.rawAngle, 0, 359.99999999999994) &&
        finite(m.angle, 0, 359.99999999999994) &&
        ["magnetic", "true"].includes(m.rawNorth) &&
        ["magnetic", "true"].includes(m.north),
      "测量角度或北向不合法",
    );
    demand(
      Math.abs(
        convertNorth(m.rawAngle, m.rawNorth, m.north, m.correction) - m.angle,
      ) < 1e-8,
      "磁偏角换算结果不一致",
    );
    demand(
      typeof m.source === "string" &&
        typeof m.timezone === "string" &&
        typeof m.ruleVersion === "string" &&
        Array.isArray(m.samples) &&
        m.samples.length <= 300 &&
        m.quality &&
        typeof m.quality.status === "string",
      "测量元数据不完整",
    );
    demand(
      p.points.find((pt) => pt.id === m.pointId)?.object === m.object,
      "测量对象与测点不一致",
    );
    demand(
      Number.isInteger(m.quality.count) &&
        finite(m.quality.count, 0, 300) &&
        typeof m.quality.version === "string" &&
        (m.quality.accuracy === null || finite(m.quality.accuracy, 0, 180)) &&
        (m.quality.spread === null || finite(m.quality.spread, 0, 180)),
      "测量质量字段不合法",
    );
    m.samples.forEach((sample) =>
      demand(
        finite(sample.angle, 0, 359.99999999999994) &&
          finite(sample.at, 0, Number.MAX_SAFE_INTEGER) &&
          sample.north === m.rawNorth &&
          typeof sample.source === "string" &&
          typeof sample.portrait === "boolean" &&
          (sample.beta === null || finite(sample.beta, -180, 180)) &&
          (sample.gamma === null || finite(sample.gamma, -90, 90)) &&
          (sample.accuracy === null || finite(sample.accuracy, 0, 180)),
        "原始采样字段不合法",
      ),
    );
    if (m.calibration)
      m.samples.forEach((sample) => {
        const device = sample as typeof sample & {
          deviceAngle: number;
          adapter: string;
        };
        const c = m.calibration!;
        demand(
          finite(device.deviceAngle, 0, 359.99999999999994) &&
            device.adapter === c.adapter &&
            Math.abs(((device.deviceAngle + c.offset) % 360) - sample.angle) <
              1e-8,
          "校准样本与原始设备角度不一致",
        );
      });
  });
  p.adoptions.forEach((a) => {
    demand(
      points.has(a.pointId) &&
        a.measurementIds.length >= 3 &&
        a.measurementIds.every((id) => measurements.has(id)) &&
        (!a.previousId || adoptions.has(a.previousId)),
      "坐向修订引用不完整",
    );
    demand(
      new Set(a.measurementIds).size === a.measurementIds.length &&
        a.measurementIds.every((id) => {
          const m = p.measurements.find((m) => m.id === id)!;
          return m.pointId === a.pointId && m.north === a.north;
        }),
      "采用修订不能混合测点或参考北",
    );
    demand(
      finite(a.angle, 0, 359.99999999999994) &&
        ["magnetic", "true"].includes(a.north) &&
        typeof a.basis === "string" &&
        a.basis.trim() &&
        typeof a.reason === "string" &&
        typeof a.manual === "boolean",
      "采用坐向字段不合法",
    );
  });
  demand(
    !p.activeAdoptionId || adoptions.has(p.activeAdoptionId),
    "采用修订引用不完整",
  );
  p.observations.forEach((o) => {
    demand(
      points.has(o.pointId) &&
        typeof o.fact === "string" &&
        typeof o.judgment === "string" &&
        typeof o.category === "string" &&
        Array.isArray(o.attachmentIds) &&
        o.attachmentIds.every((id) => attachments.has(id)),
      "观察字段或附件引用不完整",
    );
    if (o.direction != null)
      demand(
        finite(o.direction, 0, 359.99999999999994) &&
          ["magnetic", "true"].includes(o.north || ""),
        "观察方位不合法",
      );
  });
  p.overlays.forEach((o) =>
    demand(
      attachments.has(o.attachmentId) &&
        (!o.adoptionId || adoptions.has(o.adoptionId)) &&
        finite(o.topAngle, 0, 359.99999999999994) &&
        ["magnetic", "true"].includes(o.north) &&
        finite(o.center?.x, 0, 1) &&
        finite(o.center?.y, 0, 1) &&
        finite(o.opacity, 0, 1) &&
        finite(o.zoom, 0.25, 4) &&
        finite(o.pan?.x, -10000, 10000) &&
        finite(o.pan?.y, -10000, 10000) &&
        ["eight", "twenty-four"].includes(o.mode),
      "图纸示意参数不合法",
    ),
  );
  if (p.latitude != null) demand(finite(p.latitude, -90, 90), "纬度不合法");
  if (p.longitude != null) demand(finite(p.longitude, -180, 180), "经度不合法");
  for (const entity of [
    p,
    ...p.points,
    ...p.measurements,
    ...p.adoptions,
    ...p.observations,
    ...p.attachments,
    ...p.overlays,
  ])
    demand(
      typeof entity.createdAt === "string" &&
        Number.isFinite(Date.parse(entity.createdAt)),
      "记录时间不合法",
    );
}
export async function readBackup(input: Uint8Array): Promise<Project[]> {
  demand(input.length <= BACKUP_LIMITS.compressed, "备份超过 100 MiB");
  let expanded = 0;
  let count = 0;
  const names = new Set<string>();
  const files = unzipSync(input, {
    filter: (file) => {
      demand(++count <= BACKUP_LIMITS.files, "备份文件数超过限制");
      demand(
        /^(manifest\.json|projects\.json|attachments\/[a-zA-Z0-9_-]{1,100}\.png)$/.test(
          file.name,
        ) && !names.has(file.name),
        "备份含未知、重复或不安全路径",
      );
      names.add(file.name);
      expanded += file.originalSize;
      demand(expanded <= BACKUP_LIMITS.expanded, "备份展开体积超过限制");
      return true;
    },
  });
  demand(
    files["manifest.json"] && files["projects.json"],
    "缺少备份清单或项目文件",
  );
  const manifest = safeJSON(files["manifest.json"]) as Manifest;
  demand(manifest?.type === "fengshui-complete-backup", "不是本应用完整备份");
  demand(
    manifest.schemaVersion === SCHEMA_VERSION,
    "备份数据版本不兼容，请使用对应版本应用",
  );
  demand(
    Array.isArray(manifest.files) &&
      manifest.files.length === Object.keys(files).length - 1,
    "清单文件数量不一致",
  );
  const listed = new Set<string>();
  for (const record of manifest.files) {
    demand(
      record.path !== "manifest.json" &&
        !listed.has(record.path) &&
        files[record.path],
      "清单文件缺失或重复",
    );
    listed.add(record.path);
    demand(
      files[record.path].length === record.size &&
        (await hash(files[record.path])) === record.sha256,
      "备份文件损坏，摘要或长度不一致",
    );
  }
  const projects = safeJSON(files["projects.json"]) as Project[];
  demand(Array.isArray(projects) && projects.length <= 1000, "项目清单不合法");
  const projectIds = new Set<string>();
  const hydrate = (p: ProjectSnapshot) => {
    demand(p && Array.isArray(p.attachments), "附件元数据缺失");
    for (const a of p.attachments) {
      demand(
        idOK(a.id) &&
          ["plan", "photo"].includes(a.kind) &&
          ["image/png", "image/jpeg", "image/webp"].includes(a.mime),
        "附件字段不合法",
      );
      const bytes = files[`attachments/${a.id}.png`];
      demand(bytes, "附件文件缺失");
      const metadata = checkImage(bytes);
      demand(
        metadata.mime === a.mime &&
          metadata.width === a.width &&
          metadata.height === a.height,
        "附件真实格式或尺寸不一致",
      );
      a.bytes = bytes;
    }
    validateSnapshot(p);
  };
  for (const p of projects) {
    demand(!projectIds.has(p.id), "项目标识重复");
    projectIds.add(p.id);
    hydrate(p);
    demand(Array.isArray(p.reports), "报告清单缺失");
    const reportIds = new Set<string>();
    for (const report of p.reports) {
      demand(
        idOK(report.id) &&
          !reportIds.has(report.id) &&
          report.snapshot.id === p.id,
        "报告标识或所属项目不合法",
      );
      reportIds.add(report.id);
      hydrate(report.snapshot);
      demand(
        Array.isArray(report.sources) &&
          report.privacy &&
          ["location", "coordinates", "photos"].every(
            (k) =>
              typeof report.privacy[k as keyof typeof report.privacy] ===
              "boolean",
          ) &&
          Array.isArray(report.knowledge),
        "报告内容不完整",
      );
    }
  }
  return projects;
}
export function remapConflicts(
  projects: Project[],
  existing: Project[],
): Project[] {
  const allIDs = new Set<string>();
  const collect = (p: Project) => {
    allIDs.add(p.id);
    [
      p.points,
      p.measurements,
      p.adoptions,
      p.observations,
      p.attachments,
      p.overlays,
      p.reports,
    ].forEach((list) => list.forEach((x) => allIDs.add(x.id)));
  };
  existing.forEach(collect);
  return projects.map((original) => {
    const p = structuredClone(original);
    let conflict = allIDs.has(p.id);
    [
      p.points,
      p.measurements,
      p.adoptions,
      p.observations,
      p.attachments,
      p.overlays,
      p.reports,
    ].forEach((list) => {
      if (list.some((x) => allIDs.has(x.id))) conflict = true;
    });
    if (conflict) {
      const mapping = new Map<string, string>();
      const map = (id: string) => {
        if (!mapping.has(id)) mapping.set(id, uid());
        return mapping.get(id)!;
      };
      const rewrite = (snapshot: ProjectSnapshot) => {
        snapshot.id = map(snapshot.id);
        snapshot.points.forEach((x) => {
          x.id = map(x.id);
        });
        snapshot.measurements.forEach((x) => {
          x.id = map(x.id);
          x.pointId = map(x.pointId);
        });
        snapshot.adoptions.forEach((x) => {
          x.id = map(x.id);
          x.pointId = map(x.pointId);
          x.measurementIds = x.measurementIds.map(map);
          if (x.previousId) x.previousId = map(x.previousId);
        });
        if (snapshot.activeAdoptionId)
          snapshot.activeAdoptionId = map(snapshot.activeAdoptionId);
        snapshot.observations.forEach((x) => {
          x.id = map(x.id);
          x.pointId = map(x.pointId);
          x.attachmentIds = x.attachmentIds.map(map);
        });
        snapshot.attachments.forEach((x) => {
          x.id = map(x.id);
        });
        snapshot.overlays.forEach((x) => {
          x.id = map(x.id);
          x.attachmentId = map(x.attachmentId);
          if (x.adoptionId) x.adoptionId = map(x.adoptionId);
        });
      };
      p.reports.forEach((r) => {
        r.id = map(r.id);
        rewrite(r.snapshot);
      });
      rewrite(p);
      p.name = `${p.name}（导入副本）`;
    }
    collect(p);
    return p;
  });
}
export function download(
  bytes: Uint8Array | string,
  name: string,
  mime = "application/zip",
) {
  const blob = new Blob(
    [typeof bytes === "string" ? bytes : new Uint8Array(bytes)],
    { type: mime },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
