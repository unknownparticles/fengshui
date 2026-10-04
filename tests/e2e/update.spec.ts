import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("待更新版本询问全部页面，未保存测量延后，保存后无损刷新", async ({
  page,
  context,
}) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("更新保护项目");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  await page.getByLabel("方位角（度）", { exact: true }).fill("180");
  await page.getByRole("button", { name: "锁定读数", exact: true }).click();
  const settings = await context.newPage();
  await settings.goto("http://127.0.0.1:4173/fengshui/#/settings");
  await expect(settings.getByText("离线就绪", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const source = await readFile("dist/sw.js", "utf8");
  const updated =
    source.replace(
      /suffix:\s*[`'"][^`'"]+[`'"]/,
      'suffix:"update-test-version"',
    ) + "\n// 更新流程的测试版本\n";
  await writeFile("dist/sw.js", updated);
  try {
    await settings.getByRole("button", { name: "重新准备离线资源" }).click();
    await expect(
      settings.getByRole("button", { name: "保存后更新应用" }),
    ).toBeVisible({ timeout: 15000 });
    await settings.getByRole("button", { name: "保存后更新应用" }).click();
    await expect(
      settings.getByText("更新已延后：请先保存所有页面中的编辑和测量", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("方位角（度）", { exact: true })).toHaveValue(
      "180",
    );
    await expect(
      page.getByLabel("方位角（度）", { exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "保存测量", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "本次测量已记录" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "重新测量" }).click();
    const reloaded = settings.waitForEvent("load");
    await settings.getByRole("button", { name: "保存后更新应用" }).click();
    await reloaded;
    await expect(
      settings.getByRole("button", { name: "保存后更新应用" }),
    ).not.toBeVisible();
    await settings.getByRole("link", { name: "项目", exact: true }).click();
    await settings
      .getByRole("link")
      .filter({
        has: settings.getByRole("heading", {
          name: "更新保护项目",
          exact: true,
        }),
      })
      .click();
    await expect(
      settings.getByText("180.0°", { exact: false }).first(),
    ).toBeVisible();
  } finally {
    await writeFile("dist/sw.js", source);
  }
});
