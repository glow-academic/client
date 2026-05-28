// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-filters";

test.describe("demo: dashboard filters", () => {
  test("records date, role, cohort, and department filter controls", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /attempts|roles|cohorts|departments|download/i);
    const rubricFilter = page.getByPlaceholder(/filter rubrics/i).first();
    if (await rubricFilter.isVisible().catch(() => false)) {
      await rubricFilter.fill("communication");
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});