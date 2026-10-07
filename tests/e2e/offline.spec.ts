import { test, expect } from "@playwright/test";
import path from "node:path";
import { rename } from "node:fs/promises";
test("离线准备后冷启动并完成现场、图纸、资料和报告备份", async ({
  page,
  context,
}) => {
  await page.goto("#/settings");
  await expect(page.getByText("离线就绪", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const manifest = await page.request.get("manifest.webmanifest");
  expect(await manifest.json()).toMatchObject({
    id: "/fengshui/",
    start_url: "/fengshui/",
    scope: "/fengshui/",
    display: "standalone",
  });
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto("http://127.0.0.1:4173/fengshui/#/projects");
  await offline.getByLabel("项目名称", { exact: true }).fill("离线住宅");
  await offline.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(offline).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  const projectURL = offline.url();
  await offline.getByRole("link", { name: "继续测量", exact: true }).click();
  for (const angle of ["179", "180", "181"]) {
    await offline.getByLabel("方位角（度）", { exact: true }).fill(angle);
    await offline
      .getByRole("button", { name: "锁定读数", exact: true })
      .click();
    await offline
      .getByRole("button", { name: "保存测量", exact: true })
      .click();
    await expect(
      offline.getByRole("button", { name: "本次测量已记录" }),
    ).toBeDisabled();
    await offline.getByRole("button", { name: "重新测量" }).click();
  }
  await offline.goto(projectURL);
  await offline.getByLabel("建筑取向依据").fill("离线实体罗盘复测");
  await offline
    .getByRole("button", { name: "确认采用坐向", exact: true })
    .click();
  await expect(
    offline.getByRole("heading", { name: "坐子向午", exact: true }),
  ).toBeVisible();
  await offline.getByRole("button", { name: "新增观察", exact: true }).click();
  await offline.getByLabel("现场事实").fill("离线记录前方空间");
  await offline.getByLabel("人员判断").fill("待后续复核");
  await offline
    .getByLabel("导入平面图")
    .setInputFiles(path.resolve("tests/fixtures/plan.png"));
  await expect(offline.getByAltText("本地平面图，点击设置中心")).toBeVisible();
  await offline.getByLabel("中心横坐标（%）").fill("50");
  await offline.getByLabel("中心纵坐标（%）").fill("50");
  await offline.getByLabel("图顶方位角（度）").fill("90");
  await offline.getByRole("button", { name: "确认并保存方位示意" }).click();
  await offline.getByRole("button", { name: "生成报告快照" }).click();
  const reportDownload = offline.waitForEvent("download");
  await offline
    .getByRole("button", { name: "下载脱敏报告", exact: true })
    .click();
  expect((await reportDownload).suggestedFilename()).toMatch(/\.html$/);
  await offline.goto("http://127.0.0.1:4173/fengshui/#/knowledge/zi");
  await offline.reload();
  await expect(
    offline.getByRole("heading", { name: "子山 · 北方", exact: true }),
  ).toBeVisible();
  await offline.goto("http://127.0.0.1:4173/fengshui/#/settings");
  await expect(offline.getByText("当前离线", { exact: false })).toBeVisible();
  const backupDownload = offline.waitForEvent("download");
  await offline.getByRole("button", { name: "下载完整备份" }).click();
  expect((await backupDownload).suggestedFilename()).toMatch(/\.zip$/);
});
test("清理缓存只处理本应用命名空间，项目和同源其他应用保留", async ({
  page,
}) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("缓存范围测试");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  await page.evaluate(async () => {
    const own = await caches.open("fengshui:/fengshui/:test");
    await own.put("/fengshui/test", new Response("own"));
    const other = await caches.open("other-project-cache");
    await other.put("/other/test", new Response("other"));
  });
  await page.getByRole("link", { name: "设置", exact: true }).click();
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "仅清理应用缓存" }).click();
  await expect(
    page.getByText("应用缓存已清理", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => caches.keys())).toContain(
    "other-project-cache",
  );
  expect(await page.evaluate(() => caches.keys())).not.toContain(
    "fengshui:/fengshui/:test",
  );
  await page.getByRole("link", { name: "项目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "缓存范围测试", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "重新准备离线资源" }).click();
  await expect(page.getByText("离线就绪", { exact: true })).toBeVisible({
    timeout: 15000,
  });
});
test("传感器拒绝权限后保留手录入口", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", {
      value: async () => "denied",
      configurable: true,
    });
  });
  await page.goto("#/compass");
  await page.getByRole("button", { name: "启动设备检测" }).click();
  await expect(
    page.getByText(/方向权限被拒绝：.*运动与方向访问.*手录仍可使用/),
  ).toBeVisible();
  await expect(page.getByLabel("方位角（度）", { exact: true })).toBeEditable();
});

test("关键图标缺失时不宣称离线就绪，恢复后可重试", async ({ page }) => {
  await rename("dist/icons/icon-512.png", "dist/icons/icon-512.disabled");
  try {
    await page.goto("#/settings");
    await expect
      .poll(() =>
        page.evaluate(async () => {
          let entries = 0;
          for (const name of await caches.keys())
            if (name.startsWith("fengshui:/fengshui/"))
              entries += (await (await caches.open(name)).keys()).length;
          return entries;
        }),
      )
      .toBeGreaterThan(1);
    await expect(page.getByText("离线就绪", { exact: true })).not.toBeVisible();
  } finally {
    await rename("dist/icons/icon-512.disabled", "dist/icons/icon-512.png");
  }
  await page.getByRole("button", { name: "重新准备离线资源" }).click();
  await expect(page.getByText("离线就绪", { exact: true })).toBeVisible({
    timeout: 15000,
  });
});
