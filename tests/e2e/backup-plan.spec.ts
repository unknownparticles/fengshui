import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
test("图纸、照片、历史报告与完整备份跨浏览器恢复", async ({
  page,
  browser,
}) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("备份测试住宅");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  await expect(page.getByRole('heading',{name:'备份测试住宅',exact:true})).toBeVisible();
  const projectURL = page.url();
  await page.getByLabel("详细地点（可选）").fill("详细私密地址");
  await page.getByLabel("纬度（可选）").fill("31");
  await page.getByLabel("经度（可选）").fill("121");
  await page.getByRole("button", { name: "保存项目资料" }).click();
  await page
    .getByLabel("导入平面图")
    .setInputFiles(path.resolve("tests/fixtures/plan.png"));
  await expect(page.getByAltText("本地平面图，点击设置中心")).toBeVisible();
  await page.getByLabel("中心横坐标（%）").fill("50");
  await page.getByLabel("中心纵坐标（%）").fill("50");
  await page.getByLabel("图顶方位角（度）").fill("90");
  await page.getByRole("button", { name: "确认并保存方位示意" }).click();
  await expect(page.getByText("图顶 90°", { exact: false })).toContainText(
    "配置已保存",
  );
  await page.getByRole("button", { name: "新增观察", exact: true }).click();
  await page.getByLabel("现场事实").fill("图纸中心由现场人员指定");
  await page
    .getByLabel("添加现场照片")
    .setInputFiles(path.resolve("tests/fixtures/photo-exif.jpg"));
  await expect(page.getByAltText("本地现场照片")).toBeVisible();
  await expect
    .poll(() => page.getByRole("button", { name: "生成报告快照" }).isEnabled())
    .toBe(true);
  await page.getByRole("button", { name: "生成报告快照" }).click();
  await expect(page.getByTitle("报告快照预览")).toBeVisible();
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载脱敏报告", exact: true }).click();
  const report = await reportDownload;
  const html = await readFile((await report.path())!, "utf8");
  expect(html).not.toContain("详细私密地址");
  expect(html).not.toContain("坐标：31");
  expect(html).not.toContain('class="photo"');
  expect(html).toContain("人工中心方位示意");
  const frame = page.frameLocator('iframe[title="报告快照预览"]');
  await expect(
    frame.getByRole("heading", { name: "备份测试住宅", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "设置", exact: true }).click();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份", exact: true }).click();
  const backup = await backupDownload;
  const backupPath = (await backup.path())!;
  const newContext = await browser.newContext();
  const other = await newContext.newPage();
  await other.goto("http://127.0.0.1:4173/fengshui/#/settings");
  await other.getByLabel("导入完整备份").setInputFiles(backupPath);
  await expect(other.getByRole("heading", { name: "导入预览" })).toBeVisible();
  await expect(other.getByText("1 个项目 · 2 个附件")).toBeVisible();
  await other.getByRole("button", { name: "确认导入备份" }).click();
  await expect(
    other.getByRole("heading", { name: "导入预览" }),
  ).not.toBeVisible();
  await other.getByLabel("导入完整备份").setInputFiles(backupPath);
  await expect(other.getByText("备份测试住宅 · 将创建副本")).toBeVisible();
  await other.getByRole("button", { name: "确认导入备份" }).click();
  await other.getByRole("link", { name: "项目", exact: true }).click();
  await expect(
    other.getByRole("heading", {
      name: "备份测试住宅（导入副本）",
      exact: true,
    }),
  ).toBeVisible();
  await other
    .getByRole("link")
    .filter({
      has: other.getByRole("heading", { name: "备份测试住宅", exact: true }),
    })
    .click();
  await expect(other.getByText("图顶 90°", { exact: false })).toContainText(
    "配置已保存",
  );
  await expect(other.getByAltText("本地现场照片")).toBeVisible();
  await other.reload();
  await expect(other.getByAltText("本地现场照片")).toBeVisible();
  await newContext.close();
  await page.goto(projectURL);
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  for (const angle of ["179", "180", "181"]) {
    await page.getByLabel("方位角（度）", { exact: true }).fill(angle);
    await expect(page.locator('.angle')).toContainText(`${Number(angle).toFixed(1)}`);
    await page.getByRole("button", { name: "锁定读数", exact: true }).click();
    await expect(page.getByLabel('方位角（度）')).toBeDisabled();
    await page.getByRole("button", { name: "保存测量", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "本次测量已记录" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "重新测量" }).click();
  }
  await page.goto(projectURL);
  await page.getByLabel("建筑取向依据").fill("采用建筑轴线");
  await page.getByRole("button", { name: "确认采用坐向", exact: true }).click();
  await expect(page.getByText("旧示意待复核", { exact: false })).toBeVisible();

  await page.goto(projectURL);
  await page.getByLabel("项目名称", { exact: true }).fill("项目改名后");
  await page.getByRole("button", { name: "保存项目资料" }).click();
  await page.getByRole("button", { name: "查看报告", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="报告快照预览"]')
      .getByRole("heading", { name: "备份测试住宅", exact: true }),
  ).toBeVisible();
});

test("配额写入失败保留草稿，原本地数据不变且仍可导出", async ({ page }) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("失败恢复测试");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  await page.getByLabel("方位角（度）", { exact: true }).fill("180");
  await page.getByRole("button", { name: "锁定读数", exact: true }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "workspace")
        throw new DOMException("测试配额不足", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "保存测量", exact: true }).click();
  await expect(
    page.getByText("测试配额不足", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("方位角（度）", { exact: true })).toHaveValue("180");
  expect(
    await page.evaluate(async () => {
      const req = indexedDB.open("fengshui:/fengshui/:workspace");
      const db = await new Promise<IDBDatabase>((r) => {
        req.onsuccess = () => r(req.result);
      });
      const read = db
        .transaction("workspace")
        .objectStore("workspace")
        .get("current");
      const saved = await new Promise<any>((r) => {
        read.onsuccess = () => r(read.result);
      });
      db.close();
      return saved.projects[0].measurements.length;
    }),
  ).toBe(0);
  await page.getByRole("link", { name: "设置", exact: true }).click();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份" }).click();
  const file = await waiting;
  expect((await readFile((await file.path())!)).length).toBeGreaterThan(100);
});
