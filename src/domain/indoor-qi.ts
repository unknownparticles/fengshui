import { uid, nowISO } from "./model";
import {
  planIssues,
  openingGeometry,
  type FloorPlan,
  type Room,
  type Obstacle,
} from "./floor-plan";
export const QI_RULE_VERSION = "indoor-qi-v1";
export interface QiFinding {
  id: string;
  roomId?: string;
  type: "structure" | "observation" | "pending";
  level: "review" | "recorded" | "pending";
  title: string;
  evidence: string;
  interpretation: string;
  advice: string;
  line?: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    blocked: boolean;
  };
}
export interface QiAssessment {
  id: string;
  version: string;
  planId: string;
  planRevision: number;
  createdAt: string;
  plan: FloorPlan;
  findings: QiFinding[];
  summary: string;
}
export function segmentHitsRect(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rect: Obstacle,
) {
  let min = 0,
    max = 1;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  for (const [p, q] of [
    [-dx, from.x - rect.x],
    [dx, rect.x + rect.width - from.x],
    [-dy, from.y - rect.y],
    [dy, rect.y + rect.height - from.y],
  ]) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) min = Math.max(min, t);
      else max = Math.min(max, t);
      if (min > max) return false;
    }
  }
  return max > 0 && min < 1;
}
export function assessIndoor(plan: FloorPlan): QiAssessment {
  const findings: QiFinding[] = [];
  const add = (finding: Omit<QiFinding, "id">) =>
    findings.push({ id: uid(), ...finding });
  const pending = (title: string, evidence: string, room?: Room) =>
    add({
      type: "pending",
      level: "pending",
      title,
      evidence,
      roomId: room?.id,
      interpretation: "信息不完整，暂不判断是否藏风聚气。",
      advice: "补充现场信息后重新评估。",
    });
  const issues = planIssues(plan);
  if (issues.length) pending("户型需要修正", issues.join("；"));
  if (!plan.layoutConfirmed)
    pending("模板布局待现场确认", "尚未确认房间、门窗及障碍物与实际一致。");
  if (plan.topAngle == null)
    pending(
      "图顶方位尚未填写",
      "目前仅检查图内空间关系，房间方位与八卦宫位未确定。",
    );
  const entrance = plan.openings.find(
    (o) => o.entrance && o.kind === "door" && !o.toRoomId,
  );
  if (!entrance) pending("主入口待标注", "未找到作为评估起点的外门。");
  if (!issues.length && plan.layoutConfirmed && entrance) {
    const reachable = new Set([entrance.roomId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const o of plan.openings.filter(
        (o) => o.kind === "door" && o.toRoomId && o.operable,
      )) {
        if (reachable.has(o.roomId) && !reachable.has(o.toRoomId!)) {
          reachable.add(o.toRoomId!);
          changed = true;
        }
        if (reachable.has(o.toRoomId!) && !reachable.has(o.roomId)) {
          reachable.add(o.roomId);
          changed = true;
        }
      }
    }
    for (const room of plan.rooms) {
      if (!reachable.has(room.id))
        add({
          roomId: room.id,
          type: "structure",
          level: "review",
          title: `${room.name}门路未连通`,
          evidence: "按已绘制可通行门，从主入口未找到通达该房间的路径。",
          interpretation:
            "动线阻隔可类比传统“气路不畅”；也可能是漏画门，须现场确认。",
          advice: "核对门的位置与通行状态，清理通道，补绘遗漏的内门。",
        });
      else
        add({
          roomId: room.id,
          type: "structure",
          level: "recorded",
          title: `${room.name}门路可达`,
          evidence: "已绘制的可通行门能从主入口连接至该房间。",
          interpretation:
            "仅说明图示动线连通，不能据此认定通风充足或气场强弱。",
          advice: "实地走查通道宽度与家具占道情况。",
        });
    }
    const from = openingGeometry(plan, entrance).center;
    for (const exit of plan.openings.filter(
      (o) =>
        o.roomId === entrance.roomId &&
        !o.toRoomId &&
        o.id !== entrance.id &&
        o.operable,
    )) {
      const oppositeWall: { [key: string]: string } = {
        north: "south",
        south: "north",
        east: "west",
        west: "east",
      };
      if (exit.wall !== oppositeWall[entrance.wall]) continue;
      const to = openingGeometry(plan, exit).center;
      const lateral =
        entrance.wall === "north" || entrance.wall === "south"
          ? Math.abs(from.x - to.x)
          : Math.abs(from.y - to.y);
      if (lateral > Math.min(entrance.width, exit.width) / 2) continue;
      const blocked = plan.obstacles.some(
        (o) => o.roomId === entrance.roomId && segmentHitsRect(from, to, o),
      );
      add({
        roomId: entrance.roomId,
        type: "structure",
        level: "review",
        title: blocked ? "入口直线有绘制遮挡" : "入口与对侧开口直线对齐",
        evidence: `入口和对侧${exit.kind === "window" ? "外窗" : "外门"}中心横向偏差 ${lateral.toFixed(2)}m，${blocked ? "线段穿过已绘制障碍物" : "图中没有遮挡"}。`,
        interpretation: blocked
          ? "绘制障碍可改变视线与动线，但不证明实际风速减弱或聚气已改善。"
          : "可作传统“穿堂直泄”的结构参考；是否形成强风或不适需现场观察。",
        advice: blocked
          ? "核对障碍物高度、通行净宽及实际通风感受。"
          : "观察开门窗时是否直吹，优先调整可开启窗扇与家具动线；保持疏散通道畅通。",
        line: { from, to, blocked },
      });
    }
  }
  for (const room of plan.rooms) {
    const windows = plan.openings.filter(
      (o) =>
        o.roomId === room.id &&
        o.kind === "window" &&
        !o.toRoomId &&
        o.operable,
    );
    if (plan.layoutConfirmed && !issues.length) {
      add({
        roomId: room.id,
        type: "structure",
        level: windows.length ? "recorded" : "review",
        title: windows.length
          ? `${room.name}有外窗记录`
          : `${room.name}未绘制可开启外窗`,
        evidence: windows.length
          ? `已绘制 ${windows.length} 扇可开启外窗，位于 ${new Set(windows.map((w) => w.wall)).size} 侧墙面。`
          : "示意中没有可开启外窗；机械排风、采光井及遗漏窗户未记录。",
        interpretation:
          "外窗分布只是通风采光条件线索，不能计算实际换气次数或空气质量。",
        advice: windows.length
          ? "观察开窗后气流与采光，结合天气、楼层遮挡和噪声选择开启方式。"
          : "现场核对机械通风与其他开口，补充观察，不能仅凭漏画窗断定闷气。",
      });
    }
    const record = (
      key: "ventilation" | "daylight" | "dampness",
      title: string,
      labels: Record<string, string>,
      advice: Record<string, string>,
    ) => {
      const value = room[key];
      if (value === "unknown")
        pending(
          `${room.name}${title}待观察`,
          "未填写现场人员的实际感受。",
          room,
        );
      else
        add({
          roomId: room.id,
          type: "observation",
          level: ["stuffy", "drafty", "dark", "glare", "damp"].includes(value)
            ? "review"
            : "recorded",
          title: `${room.name}${title}：${labels[value]}`,
          evidence: "来自现场人员手动记录，非传感器实测。",
          interpretation:
            "可与藏风、明亮和使用舒适度一起参考，几何图不能验证这项感受。",
          advice: advice[value],
        });
    };
    record(
      "ventilation",
      "通风",
      { comfortable: "舒适", stuffy: "闷滞", drafty: "直吹明显" },
      {
        comfortable: "保留观察时间与门窗开启条件，换时段复核。",
        stuffy: "核对可开启门窗、排风设备与家具遮挡，记录改善前后的感受。",
        drafty: "调整开启方式和使用位置，避免长时间正对门窗直吹。",
      },
    );
    record(
      "daylight",
      "采光",
      { balanced: "均衡", dark: "偏暗", glare: "眩光明显" },
      {
        balanced: "在不同时间观察，记录外部遮挡与灯光使用。",
        dark: "核查窗前遮挡与照明布置，增加合适的局部照明。",
        glare: "通过遮阳、窗帘或调整座位减轻眩光，再复查。",
      },
    );
    record(
      "dampness",
      "湿度感受",
      { dry: "无明显潮湿", damp: "明显潮湿" },
      {
        dry: "仍需根据季节复查，未填写湿度计值时不输出数值。",
        damp: "检查可见潮湿位置、渗水线索和通风条件，先处理实际潮湿来源。",
      },
    );
  }
  const reviews = findings.filter((f) => f.level === "review").length,
    pendingCount = findings.filter((f) => f.level === "pending").length;
  const direct = findings.some((f) => f.line && !f.line.blocked);
  const blocked = findings.some((f) => f.title.includes("门路未连通"));
  const uncomfortable = plan.rooms.some(
    (r) => r.ventilation === "stuffy" || r.ventilation === "drafty",
  );
  const tendency =
    !plan.layoutConfirmed || issues.length || !entrance
      ? "布局信息待确认，暂不判断聚气倾向。"
      : direct
        ? "形势倾向：入口有直穿结构，宜复核穿堂与直吹。"
        : blocked
          ? "形势倾向：局部门路未通达，先复核阻隔。"
          : uncomfortable
            ? "形势倾向：动线可达，但现场通风感受需要调整。"
            : "形势倾向：图示动线可达，未检出同室入口直穿；藏风与舒适度仍结合现场感受复核。";
  return {
    id: uid(),
    version: QI_RULE_VERSION,
    planId: plan.id,
    planRevision: plan.revision,
    createdAt: nowISO(),
    plan: structuredClone(plan),
    findings,
    summary: `${tendency} ${reviews} 项需现场复核，${pendingCount} 项待补充。`,
  };
}
