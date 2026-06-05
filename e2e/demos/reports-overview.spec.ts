import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-overview";

test.describe("demo: reports overview", () => {
  test("records the reports table and bundled analytics sections", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in, then tour the loaded sections + rows.
    await settleLoaded(page, {
      scrollTexts: [/overview|leaderboard|trends|history|average score/i],
      hoverTestIds: [/^reports-profile-row-/],
    });

    await saveDemoVideo(page, TOPIC);
  });
});