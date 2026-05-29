import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "annotated-example-excellent";

test.describe("demo: annotated example excellent", () => {
  test("records a high-scoring practice card with rubric and scenario context", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^simulation-card-/);
    await scrollToText(page, /highest score|excellent|rubric|scenario|start/i);

    await saveDemoVideo(page, TOPIC);
  });
});