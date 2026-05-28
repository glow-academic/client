// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, openGenerationPanel, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "generation-events";

test.describe("demo: generation events", () => {
  test("records generation settings and event-history controls without sending a prompt", async ({ page }) => {
    await page.goto("/management/documents");
    await expectAuthenticated(page);
    await expect(page.getByTestId("documents-table")).toBeVisible({ timeout: 30_000 });

    await openGenerationPanel(page);
    await page
      .getByRole("button", { name: "Generation settings" })
      .click({ force: true, timeout: 1_000 })
      .catch(() => undefined);
    await pauseForDemo();
    await scrollToText(page, /safe mode|show full context|show user tools|tool calls/i);

    await saveDemoVideo(page, TOPIC);
  });
});