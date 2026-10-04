import type { SourceRecord } from "../data/knowledge";
import {
  circularMean,
  coveringArc,
  normalize,
  opposite,
  RULE_VERSION,
  type Declination,
  type KnownNorth,
  type Sample,
} from "./direction";

export const SCHEMA_VERSION = 1;
export const OBJECTS = [
  "建筑轴线",
  "门向",
  "窗口",
  "来水",
  "去水",
  "其他",
] as const;
export type ObjectKind = (typeof OBJECTS)[number];
export const CATEGORIES = [
  "龙",
  "砂",
  "水",
  "穴",
  "向",
  "明堂",
  "道路",
  "建筑",
  "门窗",
  "采光",
  "通风",
] as const;
export interface Point {
  id: string;
  name: string;
  object: ObjectKind;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface Measurement {
  id: string;
  pointId: string;
  object: ObjectKind;
  kind: "facing" | "sitting";
  rawAngle: number;
  rawNorth: KnownNorth;
  angle: number;
  north: KnownNorth;
  source: string;
  correction?: Declination;
  createdAt: string;
  timezone: string;
  ruleVersion: string;
  samples: Sample[];
  quality: {
    status: string;
    accuracy: number | null;
    spread: number | null;
    count: number;
    version: string;
  };
}
export interface Adoption {
  id: string;
  pointId: string;
  measurementIds: string[];
  angle: number;
  north: KnownNorth;
  basis: string;
  reason: string;
  manual: boolean;
  previousId?: string;
  createdAt: string;
  ruleVersion: string;
}
export interface Observation {
  id: string;
  pointId: string;
  category: string;
  fact: string;
  judgment: string;
  direction?: number;
  north?: KnownNorth;
  attachmentIds: string[];
  knowledgeId?: string;
  knowledgeVersion?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Attachment {
  id: string;
  kind: "plan" | "photo";
  mime: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  bytes: Uint8Array;
  createdAt: string;
}
export interface Overlay {
  id: string;
  attachmentId: string;
  center: { x: number; y: number };
  topAngle: number;
  north: KnownNorth;
  adoptionId?: string;
  mode: "eight" | "twenty-four";
  opacity: number;
  zoom: number;
  pan: { x: number; y: number };
  createdAt: string;
  ruleVersion: string;
}
export interface Privacy {
  location: boolean;
  coordinates: boolean;
  photos: boolean;
}
export const DEFAULT_PRIVACY: Privacy = {
  location: false,
  coordinates: false,
  photos: false,
};
export interface Project {
  id: string;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  points: Point[];
  measurements: Measurement[];
  adoptions: Adoption[];
  activeAdoptionId?: string;
  observations: Observation[];
  attachments: Attachment[];
  overlays: Overlay[];
  reports: Report[];
}
export type ProjectSnapshot = Omit<Project, "reports">;
export interface Report {
  sources: SourceRecord[];
  id: string;
  createdAt: string;
  timezone: string;
  appVersion: string;
  ruleVersion: string;
  privacy: Privacy;
  snapshot: ProjectSnapshot;
  knowledge: {
    id: string;
    title: string;
    version: string;
    text: string;
    sourceIds: string[];
  }[];
}
export interface Workspace {
  schemaVersion: number;
  revision: number;
  projects: Project[];
}
export const emptyWorkspace = (): Workspace => ({
  schemaVersion: SCHEMA_VERSION,
  revision: 0,
  projects: [],
});
export const uid = () => crypto.randomUUID();
export const nowISO = () => new Date().toISOString();
export const timezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const facingAngle = (m: Measurement) =>
  m.kind === "facing" ? m.angle : opposite(m.angle);
export function newProject(name: string): Project {
  if (!name.trim()) throw new Error("请填写项目名称");
  const at = nowISO();
  return {
    id: uid(),
    name: name.trim(),
    location: "",
    createdAt: at,
    updatedAt: at,
    points: [
      {
        id: uid(),
        name: "建筑轴线",
        object: "建筑轴线",
        description: "",
        createdAt: at,
        updatedAt: at,
      },
    ],
    measurements: [],
    adoptions: [],
    observations: [],
    attachments: [],
    overlays: [],
    reports: [],
  };
}
export function recommend(measurements: Measurement[]) {
  if (new Set(measurements.map((m) => m.id)).size < 3)
    return {
      angle: null,
      span: null,
      reason: "至少保存三次独立测量后确认坐向",
    };
  if (
    new Set(measurements.map((m) => `${m.pointId}:${m.object}:${m.north}`))
      .size !== 1
  )
    return {
      angle: null,
      span: null,
      reason: "测点、对象或参考北不同，不能混合确认",
    };
  const angles = measurements.map(facingAngle);
  const span = coveringArc(angles);
  const mean = circularMean(angles);
  return {
    angle: span <= 5 ? mean.angle : null,
    span,
    reason:
      span > 5
        ? "读数跨度超过 5°，请补测或填写人工选值原因"
        : "复测一致，确认取向依据后采用",
  };
}
export function adopt(
  project: Project,
  selected: Measurement[],
  basis: string,
  manualAngle?: number,
  reason = "",
): Adoption {
  if (!basis.trim()) throw new Error("请填写建筑取向依据");
  if (
    new Set(selected.map((m) => m.id)).size < 3 ||
    new Set(selected.map((m) => `${m.pointId}:${m.object}:${m.north}`)).size !==
      1
  )
    throw new Error("请使用同一测点、对象、参考北的至少三次测量");
  const suggestion = recommend(selected);
  const manual = manualAngle != null;
  if ((manual || project.activeAdoptionId) && !reason.trim())
    throw new Error("人工选值或修改坐向须填写原因");
  const angle = manual ? normalize(manualAngle) : suggestion.angle;
  if (angle == null) throw new Error(suggestion.reason);
  return {
    id: uid(),
    pointId: selected[0].pointId,
    measurementIds: selected.map((m) => m.id),
    angle,
    north: selected[0].north,
    basis: basis.trim(),
    reason: reason.trim(),
    manual,
    previousId: project.activeAdoptionId,
    createdAt: nowISO(),
    ruleVersion: RULE_VERSION,
  };
}
export function snapshot(project: Project): ProjectSnapshot {
  const { reports: _reports, ...rest } = project;
  return structuredClone(rest);
}
