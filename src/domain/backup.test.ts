import { describe, it, expect } from "vitest";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createBackup, readBackup, remapConflicts } from "./backup";
import { newProject, emptyWorkspace, adopt, type Measurement } from "./model";
import { createReport, reportHTML } from "./report";
const project = () => {
  const p = newProject("测试宅");
  p.location = "详细私密地址";
  p.latitude = 31;
  p.longitude = 121;
  p.measurements = [179, 180, 181].map(
    (angle) =>
      ({
        id: crypto.randomUUID(),
        pointId: p.points[0].id,
        object: "建筑轴线",
        kind: "facing",
        rawAngle: angle,
        rawNorth: "magnetic",
        angle,
        north: "magnetic",
        source: "手录",
        createdAt: p.createdAt,
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
      }) as Measurement,
  );
  const a = adopt(p, p.measurements, "建筑轴线");
  p.adoptions.push(a);
  p.activeAdoptionId = a.id;
  p.observations.push({
    id: crypto.randomUUID(),
    pointId: p.points[0].id,
    category: "水",
    fact: "<script>alert(1)</script>",
    judgment: "待复核",
    attachmentIds: [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
  p.reports.push(createReport(p));
  return p;
};
describe("完整备份与历史报告", () => {
  it("完整备份保留图纸、照片和历史报告引用的同一附件", async () => {
    const p = project();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const a = {
      id: crypto.randomUUID(),
      kind: "plan" as const,
      mime: "image/png" as const,
      width: 1,
      height: 1,
      bytes,
      createdAt: p.createdAt,
    };
    p.attachments.push(a);
    p.overlays.push({
      id: crypto.randomUUID(),
      attachmentId: a.id,
      center: { x: 0.5, y: 0.5 },
      topAngle: 90,
      north: "magnetic",
      adoptionId: p.activeAdoptionId,
      mode: "eight",
      opacity: 0.75,
      zoom: 1,
      pan: { x: 0, y: 0 },
      createdAt: p.createdAt,
      ruleVersion: "earth-plate-v1",
    });
    p.reports.push(createReport(p));
    const restored = await readBackup(
      await createBackup({ ...emptyWorkspace(), projects: [p] }),
    );
    expect(restored[0]).toEqual(p);
    expect(restored[0].reports[1].snapshot.attachments[0].bytes).toEqual(bytes);
  });
  it("往返保留原始测量、修订和旧报告", async () => {
    const p = project();
    const bytes = await createBackup({ ...emptyWorkspace(), projects: [p] });
    const restored = await readBackup(bytes);
    expect(restored[0]).toEqual(p);
    p.name = "新名字";
    expect(restored[0].reports[0].snapshot.name).toBe("测试宅");
  });
  it("冲突副本重映射报告与全部实体引用", () => {
    const p = project();
    const copy = remapConflicts([p], [p])[0];
    expect(copy.id).not.toBe(p.id);
    expect(copy.reports[0].snapshot.id).toBe(copy.id);
    expect(copy.measurements[0].pointId).toBe(copy.points[0].id);
    expect(copy.adoptions[0].measurementIds).toEqual(
      copy.measurements.map((m) => m.id),
    );
    expect(copy.activeAdoptionId).toBe(copy.adoptions[0].id);
    expect(copy.reports[0].snapshot.measurements[0].id).toBe(
      copy.measurements[0].id,
    );
  });
  it("损坏摘要、未来版本和未知路径拒绝导入", async () => {
    const bytes = await createBackup({
      ...emptyWorkspace(),
      projects: [project()],
    });
    const files = unzipSync(bytes);
    const damaged = { ...files, "projects.json": strToU8("[]") };
    await expect(readBackup(zipSync(damaged))).rejects.toThrow("摘要");
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    manifest.schemaVersion = 2;
    await expect(
      readBackup(
        zipSync({
          ...files,
          "manifest.json": strToU8(JSON.stringify(manifest)),
        }),
      ),
    ).rejects.toThrow("版本");
    await expect(
      readBackup(zipSync({ ...files, "../unknown": strToU8("bad") })),
    ).rejects.toThrow("路径");
  });
  it("报告默认真正省略详细地点与坐标，转义脚本文本", () => {
    const report = project().reports[0];
    const html = reportHTML(report);
    expect(html).not.toContain("详细私密地址");
    expect(html).not.toContain("坐标：31");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(
      reportHTML(report, { location: true, coordinates: true, photos: true }),
    ).toContain("详细私密地址");
  });
  it("拒绝虚报展开量的压缩包", async () => {
    const bytes = await createBackup({
      ...emptyWorkspace(),
      projects: [project()],
    });
    const inflated = new Uint8Array(bytes);
    const view = new DataView(inflated.buffer);
    for (let i = 0; i + 28 < inflated.length; i++) {
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 300 * 1024 * 1024, true);
        break;
      }
    }
    await expect(readBackup(inflated)).rejects.toThrow("展开体积");
  });
});
