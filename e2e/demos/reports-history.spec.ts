// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-history";

test.describe("demo: reports history", () => {
  test("records report history rows and profile search", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    const search = page.getByPlaceholder(/search profiles by name or email/i);
    if (await search.isVisible().catch(() => false)) {
      await search.fill("smith");
      await search.press("Enter");
      await pauseForDemo();
    }
    await scrollToText(page, /history|attempt|score|time|chats/i);

    await saveDemoVideo(page, TOPIC);
  });
});