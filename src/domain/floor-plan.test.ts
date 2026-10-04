import { describe, expect, it } from "vitest";
import {
  templatePlan,
  validateFloorPlan,
  planIssues,
  moveRoom,
  openingGeometry,
} from "./floor-plan";
import { assessIndoor, segmentHitsRect } from "./indoor-qi";
import { createBackup, readBackup, remapConflicts } from "./backup";
import { emptyWorkspace, newProject } from "./model";
import { createReport, reportHTML } from "./report";
describe("快捷户型与室内气检查", () => {
  it.each(["one-bedroom", "two-bedroom"] as const)(
    "模板 %s 门窗与尺寸有效",
    (template) => {
      for (const size of [4, 8, 10]) {
        const p = templatePlan(template, size, size);
        expect(() => validateFloorPlan(p)).not.toThrow();
        expect(p.openings.some((o) => o.entrance)).toBe(true);
      }
    },
  );
  it("越界、重叠和断开的内门拒绝保存", () => {
    const p = templatePlan("two-bedroom");
    p.rooms[0].width = 9;
    expect(planIssues(p).some((i) => i.includes("重叠"))).toBe(true);
    p.rooms[0].width = 50;
    expect(() => validateFloorPlan(p)).toThrow("越界");
    const q = templatePlan("two-bedroom");
    q.openings.find((o) => o.toRoomId)!.toRoomId = "missing";
    expect(planIssues(q).some((i) => i.includes("邻接"))).toBe(true);
  });
  it("未确认模板与未知感受不产生肯定气场结论", () => {
    const p = templatePlan("two-bedroom");
    const q = assessIndoor(p);
    expect(q.findings.every((f) => f.type === "pending")).toBe(true);
    expect(q.findings.some((f) => f.title.includes("采光待观察"))).toBe(true);
  });
  it("直穿结构、遮挡和门路分别给出依据", () => {
    const p = templatePlan("two-bedroom");
    p.layoutConfirmed = true;
    p.topAngle = 0;
    p.north = "magnetic";
    let q = assessIndoor(p);
    expect(q.findings.some((f) => f.title === "入口与对侧开口直线对齐")).toBe(
      true,
    );
    expect(q.findings.some((f) => f.title.includes("门路未连通"))).toBe(false);
    const room = p.rooms[0];
    p.obstacles.push({
      id: crypto.randomUUID(),
      roomId: room.id,
      name: "屏风",
      x: room.width / 2 - 0.25,
      y: 3,
      width: 0.5,
      height: 0.5,
    });
    q = assessIndoor(p);
    expect(q.findings.some((f) => f.line?.blocked)).toBe(true);
    p.openings = p.openings.filter((o) => o.toRoomId !== room.id);
    q = assessIndoor(p);
    expect(q.findings.some((f) => f.title.includes("门路未连通"))).toBe(true);
  });
  it("拖动按网格，并保持障碍相对房间位置", () => {
    const p = templatePlan("blank");
    p.rooms = templatePlan("two-bedroom").rooms.slice(0, 1);
    const moved = moveRoom(p, p.rooms[0].id, 0.31, 0);
    expect(moved.rooms[0].x).toBe(0.25);
    expect(p.rooms[0].x).toBe(0);
  });
  it("障碍线段判定包括相交和不相交", () => {
    const rect = {
      id: "o",
      roomId: "r",
      name: "屏风",
      x: 2,
      y: 3,
      width: 1,
      height: 1,
    };
    expect(segmentHitsRect({ x: 2.5, y: 0 }, { x: 2.5, y: 8 }, rect)).toBe(
      true,
    );
    expect(segmentHitsRect({ x: 0, y: 0 }, { x: 0, y: 8 }, rect)).toBe(false);
  });
  it("户型与气评估备份、副本和历史报告一致", async () => {
    const p = newProject("室内测试");
    const plan = templatePlan("two-bedroom");
    plan.layoutConfirmed = true;
    plan.rooms[0].notes = "<script>不执行</script>";
    p.floorPlans = [plan];
    p.qiAssessments = [assessIndoor(plan)];
    p.reports.push(createReport(p));
    const restored = (
      await readBackup(
        await createBackup({ ...emptyWorkspace(), projects: [p] }),
      )
    )[0];
    expect(restored).toEqual(p);
    const copy = remapConflicts([p], [p])[0];
    expect(copy.floorPlans![0].id).not.toBe(plan.id);
    expect(copy.qiAssessments![0].planId).toBe(copy.floorPlans![0].id);
    expect(copy.qiAssessments![0].plan.rooms[0].id).toBe(
      copy.floorPlans![0].rooms[0].id,
    );
    expect(copy.reports[0].snapshot.floorPlans![0].id).toBe(
      copy.floorPlans![0].id,
    );
    const html = reportHTML(p.reports[0]);
    expect(html).toContain("室内的气");
    expect(html).toContain("&lt;script&gt;");
    plan.rooms[0].name = "后来改名";
    expect(reportHTML(p.reports[0])).not.toContain("后来改名");
  });
});
