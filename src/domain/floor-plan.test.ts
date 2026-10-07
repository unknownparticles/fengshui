import { describe, expect, it } from "vitest";
import {
  templatePlan,
  validateFloorPlan,
  planIssues,
  moveRoom,
  openingGeometry,
  drawnRoom,
  openingAt,
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
  it("反向拖框吸附网格，过道可以窄于普通房间，重叠不会建立", () => {
    const p = templatePlan("blank");
    p.rooms.push(
      drawnRoom(p, { x: 4.1, y: 4 }, { x: -1, y: 0 }, "卧室", "卧室"),
    );
    expect(p.rooms[0]).toMatchObject({ x: 0, y: 0, width: 4, height: 4 });
    p.rooms.push(
      drawnRoom(p, { x: 4, y: 0 }, { x: 4.5, y: 8 }, "过道", "走廊"),
    );
    expect(() => validateFloorPlan(p)).not.toThrow();
    expect(() =>
      drawnRoom(p, { x: 1, y: 1 }, { x: 3, y: 3 }, "重叠", "卧室"),
    ).toThrow("重叠");
    expect(() =>
      drawnRoom(p, { x: 5, y: 0 }, { x: 5.5, y: 2 }, "太窄", "卧室"),
    ).toThrow("尺寸不足");
  });
  it("点墙建立内门自动关联过道，窗和主入口不能放内墙", () => {
    const p = templatePlan("blank");
    p.rooms.push(drawnRoom(p, { x: 0, y: 0 }, { x: 4, y: 4 }, "卧室", "卧室"));
    p.rooms.push(drawnRoom(p, { x: 4, y: 0 }, { x: 5, y: 8 }, "过道", "走廊"));
    const r = p.rooms[0];
    const point = { x: 4, y: 2 };
    const door = openingAt(p, r.id, point, "door");
    expect(door.toRoomId).toBe(p.rooms[1].id);
    expect(() => openingAt(p, r.id, point, "window")).toThrow("内墙");
    expect(() => openingAt(p, r.id, point, "door", true)).toThrow("主入口");
    p.openings.push(door);
    expect(() => openingAt(p, r.id, point, "door")).toThrow("已有门窗");
    const window = openingAt(p, r.id, { x: 0.1, y: 0 }, "window");
    expect(openingGeometry(p, window).start.x).toBeCloseTo(0);
    expect(() => openingAt(p, r.id, { x: 2, y: 2 }, "door")).toThrow("边缘");
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
    const image = {
      id: crypto.randomUUID(),
      kind: "plan" as const,
      mime: "image/png" as const,
      width: 1,
      height: 1,
      bytes: Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        ),
        (c) => c.charCodeAt(0),
      ),
      createdAt: p.createdAt,
    };
    p.attachments.push(image);
    plan.backgroundId = image.id;
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
    expect(copy.floorPlans![0].backgroundId).toBe(copy.attachments[0].id);
    expect(copy.qiAssessments![0].plan.backgroundId).toBe(
      copy.attachments[0].id,
    );
    expect(copy.reports[0].snapshot.floorPlans![0].backgroundId).toBe(
      copy.reports[0].snapshot.attachments[0].id,
    );
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
