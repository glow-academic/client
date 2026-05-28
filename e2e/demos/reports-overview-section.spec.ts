// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-overview-section";

test.describe("demo: reports overview section", () => {
  test("records simulation-level overview metrics", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /attempts|completed|passed|average score|pass rate/i);

    await saveDemoVideo(page, TOPIC);
  });
});