// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tests-overview";

test.describe("demo: tests overview", () => {
  test("records eval cards and test history as the client test surface", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^eval-card-/);
    await scrollToText(page, /test|eval|run|history|models|rubric/i);

    await saveDemoVideo(page, TOPIC);
  });
});