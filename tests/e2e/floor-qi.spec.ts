import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("快捷户型、室内聚气评估、修订快照和离线备份恢复", async ({
  page,
  context,
  browser,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("#/settings");
  await expect(page.getByText("离线就绪", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await context.setOffline(true);
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("户型聚气验证");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  const url = page.url();
  const quick = page.locator(".quick-floor-plan");
  await quick.getByRole("button", { name: "两室一厅", exact: true }).click();
  await expect(quick.getByRole("img", { name: /户型示意/ })).toBeVisible();
  await quick
    .getByRole("button", { name: "保存户型修订", exact: true })
    .click();
  await quick
    .getByRole("button", { name: "评估室内的气", exact: true })
    .click();
  await expect(
    quick.getByRole("heading", { name: "模板布局待现场确认", exact: true }),
  ).toBeVisible();
  await quick.getByLabel("已按现场确认房间、门窗、入口和障碍物").check();
  await quick.getByLabel("户型图顶方位角（度，可选）").fill("90");
  await quick.getByLabel("通风感受").selectOption("stuffy");
  await quick.getByLabel("采光感受").selectOption("dark");
  await quick.getByLabel("潮湿感受").selectOption("dry");
  await quick.getByLabel("房间观察备注").fill("现场开窗条件下仍感觉闷滞");
  await quick
    .getByRole("button", { name: "保存户型修订", exact: true })
    .click();
  await quick
    .getByRole("button", { name: "评估室内的气", exact: true })
    .click();
  await expect(
    quick.getByRole("heading", { name: "入口与对侧开口直线对齐", exact: true }),
  ).toBeVisible();
  await expect(
    quick.getByRole("heading", { name: "客厅通风：闷滞", exact: true }),
  ).toBeVisible();
  await quick
    .getByRole("button", { name: "生成 PNG 并用于方位叠加", exact: true })
    .click();
  await expect(
    page.getByText("图顶 90°", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "生成报告快照", exact: true }).click();
  const reportWaiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载脱敏报告", exact: true }).click();
  const html = await readFile((await (await reportWaiting).path())!, "utf8");
  expect(html).toContain("入口与对侧开口直线对齐");
  expect(html).toContain("室内的气");
  expect(html).toContain("现场开窗条件下仍感觉闷滞");
  await quick.getByRole("button", { name: "添加障碍物", exact: true }).click();
  await quick
    .getByRole("button", { name: "保存户型修订", exact: true })
    .click();
  await expect(
    quick.getByText("当前展示草稿或旧户型评估", { exact: false }),
  ).toBeVisible();
  await quick
    .getByRole("button", { name: "评估室内的气", exact: true })
    .click();
  await expect(
    quick.getByRole("heading", { name: "入口直线有绘制遮挡", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(quick.getByLabel("通风感受")).toHaveValue("stuffy");
  await expect(
    quick.getByRole("heading", { name: "入口直线有绘制遮挡", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await quick.screenshot({ path: "test-results/quick-floor-plan-mobile.png" });
  await page.getByRole("link", { name: "设置", exact: true }).click();
  const backupWaiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份", exact: true }).click();
  const file = (await (await backupWaiting).path())!;
  const restoredContext = await browser.newContext();
  const other = await restoredContext.newPage();
  await other.goto("http://127.0.0.1:4173/fengshui/#/settings");
  await other.getByLabel("导入完整备份").setInputFiles(file);
  await expect(
    other.getByRole("heading", { name: "导入预览", exact: true }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "确认导入备份", exact: true })
    .click();
  await expect(
    other.getByRole("heading", { name: "导入预览", exact: true }),
  ).not.toBeVisible();
  await other.goto(url);
  await expect(
    other
      .locator(".quick-floor-plan")
      .getByRole("heading", { name: "入口直线有绘制遮挡", exact: true }),
  ).toBeVisible();
  await restoredContext.close();
});
test("户型尺寸与内门错误不保存，空白可加房间", async ({ page }) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("户型编辑验证");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  const quick = page.locator(".quick-floor-plan");
  await quick.getByRole("button", { name: "空白户型", exact: true }).click();
  await quick.getByRole("button", { name: "添加房间", exact: true }).click();
  await quick.getByLabel("房间宽（m）", { exact: true }).fill("50");
  await quick
    .getByRole("button", { name: "保存户型修订", exact: true })
    .click();
  await expect(quick.getByRole("alert")).toContainText("越界");
  await quick.getByLabel("房间宽（m）", { exact: true }).fill("3");
  await quick
    .getByRole("button", { name: "保存户型修订", exact: true })
    .click();
  await expect(quick.getByText("已保存修订 1", { exact: false })).toBeVisible();
});
