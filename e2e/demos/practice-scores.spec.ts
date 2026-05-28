// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-scores";

test.describe("demo: practice scores", () => {
  test("records score badges and practice history context", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^simulation-card-/);
    await scrollToText(page, /highest score|pass|score|rubric|scenario/i);
    const historySearch = page.getByPlaceholder(/search by name, simulation, or scenarios/i).first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded();
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});