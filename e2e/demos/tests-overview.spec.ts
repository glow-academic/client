import { test } from "@playwright/test";

import { expectAuthenticated, expectBenchmarkGridVisible, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tests-overview";

test.describe("demo: tests overview", () => {
  test("records eval cards and test history as the client test surface", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expectBenchmarkGridVisible(page);
    await pauseForDemo();

    await hoverFirstVisible(page, /^eval-card-/);
    await scrollToText(page, /test|eval|run|history|models|rubric/i);

    await saveDemoVideo(page, TOPIC);
  });
});