import { test } from "@playwright/test";

import { expectAuthenticated, expectBenchmarkGridVisible, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-test-config";

test.describe("demo: benchmark test config", () => {
  test("records model and rubric context before starting a benchmark", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expectBenchmarkGridVisible(page);
    await pauseForDemo();

    await hoverFirstVisible(page, "eval-title");
    await hoverFirstVisible(page, "eval-models");
    await scrollToText(page, /rubric|model|duration|configuration|standard/i);

    await saveDemoVideo(page, TOPIC);
  });
});