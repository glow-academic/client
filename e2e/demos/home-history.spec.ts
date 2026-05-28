// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-history";

test.describe("demo: home attempt history", () => {
  test("records the assigned-training history table and filters", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    const historySearch = page.getByPlaceholder(/search by name, simulation, or scenarios/i).first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.fill("office");
      await historySearch.press("Enter");
      await pauseForDemo();
    }
    await scrollToText(page, /score|simulation|scenario|continue|view|retry/i);

    await saveDemoVideo(page, TOPIC);
  });
});