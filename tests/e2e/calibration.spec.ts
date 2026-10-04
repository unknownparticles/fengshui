import { test, expect } from "@playwright/test";
test("现场已知方向校准后，稳定锁定并保留测量来源", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", {
      value: async () => "granted",
      configurable: true,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("校准现场");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  const url = page.url();
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  await page.getByRole("button", { name: "启动设备检测", exact: true }).click();
  await page.evaluate(() => {
    const e = new Event("deviceorientation");
    Object.assign(e, {
      webkitCompassHeading: 350,
      webkitCompassAccuracy: 2,
      beta: 0,
      gamma: 0,
      alpha: 10,
      absolute: true,
    });
    window.dispatchEvent(e);
  });
  await page.getByLabel("已知参考角度（度）").fill("359");
  await page.getByLabel("校准依据").fill("实体罗盘同方向对照");
  await page
    .getByRole("button", { name: "对准参考方向并校准", exact: true })
    .click();
  await page.evaluate(async () => {
    for (let i = 0; i < 14; i++) {
      const e = new Event("deviceorientation");
      Object.assign(e, {
        webkitCompassHeading: 352,
        webkitCompassAccuracy: 2,
        beta: 0,
        gamma: 0,
        alpha: 8,
        absolute: true,
      });
      window.dispatchEvent(e);
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  await expect(page.locator(".angle")).toContainText("1.0");
  await page.getByRole("button", { name: "锁定校准测量", exact: true }).click();
  await page
    .locator(".compass-side")
    .getByRole("button", { name: "保存测量", exact: true })
    .click();
  await expect(
    page
      .locator(".compass-side")
      .getByRole("button", { name: "本次测量已记录" }),
  ).toBeDisabled();
  await page.goto(url);
  await page.getByText("查看原始记录", { exact: true }).click();
  await expect(
    page.getByText("人工参考校准 · WebKit 罗盘扩展", { exact: false }),
  ).toBeVisible();
});
