import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-header";

test.describe("demo: dashboard header", () => {
  test("records the dashboard KPI strip and carousel controls", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /total attempts|average score|completion|pass rate/i);
    await hoverFirstVisible(page, "dashboard-header-carousel-next");

    await saveDemoVideo(page, TOPIC);
  });
});
