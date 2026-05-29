import { expect, test } from "@playwright/test";

import { expectAuthenticated, openGenerationPanel, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "generation-overview";

test.describe("demo: generation overview", () => {
  test("records the AI generation panel, prompt suggestions, and instruction box", async ({ page }) => {
    await page.goto("/training/personas");
    await expectAuthenticated(page);
    await expect(page.getByTestId("page-header")).toBeVisible({ timeout: 30_000 });

    await openGenerationPanel(page);
    await page.getByPlaceholder("Instructions...").fill("Draft a cleaner onboarding persona.");
    await pauseForDemo();
    await scrollToText(page, /new chat|generation settings|safe mode|instructions/i);

    await saveDemoVideo(page, TOPIC);
  });
});