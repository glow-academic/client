import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-trends";

test.describe("demo: reports trends", () => {
  test("records trend and filter controls for report time windows", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /trends|date|average score|pass rate|attempts/i);
    const search = page.getByPlaceholder(/search profiles by name or email/i);
    if (await search.isVisible().catch(() => false)) {
      await search.fill("ta");
      await search.press("Enter");
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});
