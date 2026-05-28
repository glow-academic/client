// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-history";

test.describe("demo: dashboard history", () => {
  test("records the inline attempt history search below dashboard panels", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    const historySearch = page.getByPlaceholder(/search by name, simulation, or scenarios/i).first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded();
      await historySearch.fill("confused");
      await historySearch.press("Enter");
      await pauseForDemo();
    }
    await scrollToText(page, /score|scenario|simulation|date|view/i);

    await saveDemoVideo(page, TOPIC);
  });
});