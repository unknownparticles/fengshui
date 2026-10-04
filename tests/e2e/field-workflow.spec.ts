import { test, expect } from "@playwright/test";

test("手录三次、确认坐向、草稿保存及深层刷新", async ({ page }) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("测试住宅");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "测试住宅", exact: true }),
  ).toBeVisible();
  const projectURL = page.url();
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  for (const angle of ["179", "180", "181"]) {
    await page.getByLabel("方位角（度）", { exact: true }).fill(angle);
    await page.getByRole("button", { name: "锁定读数", exact: true }).click();
    await expect(
      page.getByLabel("方位角（度）", { exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "保存测量", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "本次测量已记录" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "重新测量" }).click();
  }
  await page.goto(projectURL);
  await expect(page.getByText("推荐向角", { exact: false })).toContainText(
    "180.0°",
  );
  await page.getByLabel("建筑取向依据").fill("实体罗盘复测建筑轴线");
  await page.getByRole("button", { name: "确认采用坐向", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "坐子向午", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新增观察", exact: true }).click();
  await page.getByLabel("现场事实").fill("东侧有沟渠，水流方向未判断");
  await page.getByLabel("人员判断").fill("待现场补测");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const request = indexedDB.open("fengshui:/fengshui/:workspace");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = reject;
        });
        const read = db
          .transaction("workspace")
          .objectStore("workspace")
          .get("current");
        const value = await new Promise<any>((resolve) => {
          read.onsuccess = () => resolve(read.result);
        });
        db.close();
        return value.projects[0].observations[0]?.judgment;
      }),
    )
    .toBe("待现场补测");
  await page.reload();
  await expect(page.getByLabel("现场事实")).toHaveValue(
    "东侧有沟渠，水流方向未判断",
  );
  await expect(
    page.getByRole("heading", { name: "坐子向午", exact: true }),
  ).toBeVisible();
});

test("移动布局、跨零边界、主题保留锁定值、资料深层链接", async ({ page }) => {
  await page.goto("#/projects");
  await page.getByLabel("项目名称", { exact: true }).fill("界面验证项目");
  await page.getByRole("button", { name: "建立项目", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects\/[a-f0-9-]+$/);
  await page.getByRole("link", { name: "继续测量", exact: true }).click();
  await page.getByLabel("方位角（度）", { exact: true }).fill("7.49");
  await expect(page.locator(".sitting-facing")).toHaveText("坐午 · 向子");
  await expect(
    page.getByText("临近子／癸山界", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "锁定读数", exact: true }).click();
  await page.getByRole("button", { name: "切换墨黑主题" }).click();
  await expect(page.getByLabel("方位角（度）")).toBeDisabled();
  await expect(page.getByLabel("方位角（度）")).toHaveValue("7.49");
  await page.screenshot({
    path: "test-results/compass-desktop.png",
    fullPage: true,
  });
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/compass-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll<HTMLElement>(
        "h1,h2,h3,p,label,button,a,summary,span",
      ),
    ];
    const sizes = nodes.map((el) => parseFloat(getComputedStyle(el).fontSize));
    nodes.forEach((el, i) => {
      el.style.fontSize = `${sizes[i] * 2}px`;
      el.style.overflowWrap = "anywhere";
    });
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("#/knowledge/zi");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "子山 · 北方", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("中心角 0°", { exact: false })).toBeVisible();
});
