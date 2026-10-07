import { test, expect, type Locator } from "@playwright/test";

async function screenPoint(canvas: Locator, x: number, y: number) {
  return canvas.evaluate(
    (element, point) => {
      const svg = element as SVGSVGElement;
      const p = svg.createSVGPoint();
      p.x = point.x;
      p.y = point.y;
      const result = p.matrixTransform(svg.getScreenCTM()!);
      return { x: result.x, y: result.y };
    },
    { x, y },
  );
}

test("导入底图后拖框建立房间、过道，点墙连接门窗并保存恢复", async ({
  page,
  context,
}) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("图纸描画验证");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  const quick = page.locator(".quick-floor-plan");
  await quick
    .getByLabel("导入户型图作为底图")
    .setInputFiles("tests/fixtures/plan.png");
  const canvas = quick.locator(".floor-plan-canvas").first();
  await expect(canvas.locator("image")).toHaveCount(1);
  async function draw(x: number, y: number, endX: number, endY: number) {
    await canvas.scrollIntoViewIfNeeded();
    const start = await screenPoint(canvas, x, y),
      end = await screenPoint(canvas, endX, endY);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  }
  async function place(x: number, y: number) {
    await canvas.scrollIntoViewIfNeeded();
    const point = await screenPoint(canvas, x, y);
    await page.mouse.click(point.x, point.y);
  }
  await draw(0, 0, 4, 4);
  await quick.getByRole("button", { name: "画过道", exact: true }).click();
  await draw(4, 0, 5, 8);
  await expect(quick.getByLabel("选中房间").locator("option")).toHaveCount(3);
  await expect(
    quick.getByRole("combobox", { name: "房间用途", exact: true }),
  ).toHaveValue("走廊");
  await quick.getByRole("button", { name: "点墙加门", exact: true }).click();
  await place(4, 2);
  await expect(quick.getByLabel("门路连接")).toHaveValue(
    (await quick
      .getByLabel("选中房间")
      .locator("option", { hasText: "过道" })
      .getAttribute("value")) || "",
  );
  await quick.getByRole("button", { name: "点墙加窗", exact: true }).click();
  await place(2, 0);
  await quick.getByRole("button", { name: "主入口", exact: true }).click();
  await place(4.5, 8);
  await expect(quick.getByLabel("设为主入口")).toBeChecked();
  await quick
    .getByRole("button", { name: "保存户型修订", exact: true })
    .click();
  await expect(quick.getByText("已保存修订 1", { exact: false })).toBeVisible();
  await page.reload();
  await expect(canvas.locator("image")).toHaveCount(1);
  await expect(quick.getByLabel("选中房间").locator("option")).toHaveCount(3);
  await quick.getByRole("button", { name: "画房间", exact: true }).click();
  await draw(1, 1, 3, 3);
  await expect(quick.getByRole("alert")).toContainText("重叠");
  await expect(quick.getByLabel("选中房间").locator("option")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await canvas.scrollIntoViewIfNeeded();
  const start = await screenPoint(canvas, 5, 0),
    end = await screenPoint(canvas, 9, 4);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [start],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [end],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(quick.getByLabel("选中房间").locator("option")).toHaveCount(4);
  await quick.getByRole("button", { name: "撤销上一步", exact: true }).click();
  await expect(quick.getByLabel("选中房间").locator("option")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await canvas.scrollIntoViewIfNeeded();
  await quick.screenshot({ path: "test-results/import-draw-mobile.png" });
});

test("手机罗盘无须人工校准即可显示、锁定和保存，手录优先且过期停止锁定", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", {
      value: async () => "granted",
      configurable: true,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("手机指南针验证");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  const url = page.url();
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  await page.getByRole("button", { name: "启动设备检测", exact: true }).click();
  await page.evaluate(async () => {
    for (let i = 0; i < 14; i++) {
      const e = new Event("deviceorientation");
      Object.assign(e, {
        webkitCompassHeading: 92,
        webkitCompassAccuracy: 2,
        alpha: 268,
        beta: 0,
        gamma: 0,
        absolute: true,
      });
      window.dispatchEvent(e);
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  await expect(page.locator(".angle")).toContainText("92.0");
  await expect(
    page.getByRole("button", { name: "锁定设备测量", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "锁定设备测量", exact: true }),
  ).toBeDisabled({ timeout: 5000 });
  await page.evaluate(() => {
    const e = new Event("deviceorientation");
    Object.assign(e, {
      webkitCompassHeading: 92,
      webkitCompassAccuracy: 2,
      beta: 0,
      gamma: 0,
    });
    window.dispatchEvent(e);
  });
  await page.getByLabel("方位角（度）", { exact: true }).fill("180");
  await page.evaluate(() => {
    const e = new Event("deviceorientation");
    Object.assign(e, { webkitCompassHeading: 92, beta: 0, gamma: 0 });
    window.dispatchEvent(e);
  });
  await expect(page.locator(".angle")).toContainText("180.0");
  await page.getByLabel("方位角（度）", { exact: true }).fill("");
  await page.evaluate(async () => {
    for (let i = 0; i < 14; i++) {
      const e = new Event("deviceorientation");
      Object.assign(e, {
        webkitCompassHeading: 92,
        webkitCompassAccuracy: 2,
        beta: 0,
        gamma: 0,
      });
      window.dispatchEvent(e);
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  await page.getByRole("button", { name: "锁定设备测量", exact: true }).click();
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
    page.getByText("设备指南针 · WebKit 罗盘扩展", { exact: false }),
  ).toBeVisible();
});
