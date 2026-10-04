import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openDB } from "idb";
import { WorkspaceStore } from "./workspace";
import { emptyWorkspace, newProject } from "../domain/model";
import { adopt, recommend, type Measurement } from "../domain/model";
const readings = (angles: number[]): Measurement[] =>
  angles.map((angle, i) => ({
    id: `m${i}`,
    pointId: "p1",
    object: "建筑轴线",
    kind: "facing",
    rawAngle: angle,
    angle,
    rawNorth: "magnetic",
    north: "magnetic",
    source: "手录",
    createdAt: "2026-10-04T08:00:00Z",
    timezone: "Asia/Shanghai",
    ruleVersion: "earth-plate-v1",
    samples: [],
    quality: {
      status: "手录",
      accuracy: null,
      spread: null,
      count: 0,
      version: "manual-v1",
    },
  }));
describe("本地数据和坐向修订", () => {
  it("保存后可重新打开，并阻止第二页面的过期覆盖", async () => {
    const name = crypto.randomUUID();
    const a = new WorkspaceStore(name);
    const b = new WorkspaceStore(name);
    const first = await a.open();
    await b.open();
    first.projects.push(newProject("项目甲"));
    expect(await a.save(first, 0)).toBe(1);
    await expect(b.save(emptyWorkspace(), 0)).rejects.toThrow("另一页面");
    const c = new WorkspaceStore(name);
    expect((await c.open()).projects[0].name).toBe("项目甲");
    a.close();
    b.close();
    c.close();
  });
  it("未知较新数据库只读，不清空并提供原始导出", async () => {
    const name = crypto.randomUUID();
    const db = await openDB(name, 2, {
      upgrade(d) {
        d.createObjectStore("workspace");
      },
    });
    await db.put(
      "workspace",
      {
        ...emptyWorkspace(),
        schemaVersion: 2,
        revision: 8,
        projects: [newProject("未来记录")],
      },
      "current",
    );
    db.close();
    const store = new WorkspaceStore(name);
    const value = await store.open();
    expect(store.mode).toBe("readonly");
    expect(value.projects[0].name).toBe("未来记录");
    await expect(store.save(emptyWorkspace(), 8)).rejects.toThrow("只读");
    expect(await store.rawExport()).toHaveProperty("databaseVersion", 2);
    store.close();
  });
  it("三次一致复测由用户确认；修订留存前版本", () => {
    const p = newProject("现场");
    const list = readings([179, 180, 181]);
    expect(recommend(list).angle).toBeCloseTo(180);
    const first = adopt(p, list, "以建筑轴线为依据");
    p.adoptions.push(first);
    p.activeAdoptionId = first.id;
    expect(() => adopt(p, list, "补测", 182)).toThrow("原因");
    const second = adopt(p, list, "补测", 182, "复核轴线");
    expect(second.previousId).toBe(first.id);
    expect(p.adoptions[0].angle).toBe(180);
  });
  it("不一致、混合对象和参考北不自动采用", () => {
    expect(recommend(readings([170, 180, 190])).angle).toBeNull();
    const mixed = readings([179, 180, 181]);
    mixed[1].north = "true";
    expect(recommend(mixed).angle).toBeNull();
    mixed[1].north = "magnetic";
    mixed[1].object = "门向";
    expect(recommend(mixed).angle).toBeNull();
    expect(() => adopt(newProject("现场"), readings([1, 2]), "依据")).toThrow(
      "三次",
    );
  });
});
