// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-overview";

test.describe("demo: reports overview", () => {
  test("records the reports table and bundled analytics sections", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /overview|leaderboard|trends|history|average score/i);
    await hoverFirstVisible(page, /^reports-profile-row-/);

    await saveDemoVideo(page, TOPIC);
  });
});