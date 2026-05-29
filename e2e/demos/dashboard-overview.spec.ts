import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-overview";

test.describe("demo: dashboard overview", () => {
  test("records the analytics dashboard", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);

    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, "dashboard-header-carousel-next");
    await hoverFirstVisible(page, "dashboard-primary-carousel-next");
    await hoverFirstVisible(page, "dashboard-secondary-carousel-next");

    await saveDemoVideo(page, TOPIC);
  });
});