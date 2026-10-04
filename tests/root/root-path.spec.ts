import { test, expect } from "@playwright/test";
test("根路径构建可以安装准备、离线冷启动及资料深层刷新", async ({
  page,
  context,
}) => {
  await page.goto("#/settings");
  await expect(page.getByText("离线就绪", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
  ).toBe("http://127.0.0.1:4174/sw.js");
  await context.setOffline(true);
  await page.goto("#/knowledge/zi");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "子山 · 北方", exact: true }),
  ).toBeVisible();
});
