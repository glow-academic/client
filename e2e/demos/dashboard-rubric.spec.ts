// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-rubric";

test.describe("demo: dashboard rubric breakdown", () => {
  test("records rubric trend, heatmap, and skill performance panels", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /rubric|standard|skill|threshold|score/i);
    await hoverFirstVisible(page, "dashboard-primary-carousel-next");
    await hoverFirstVisible(page, "rubric-trend-insight");

    await saveDemoVideo(page, TOPIC);
  });
});