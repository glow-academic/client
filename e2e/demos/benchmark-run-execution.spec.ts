import { test } from "@playwright/test";

import { expectAuthenticated, expectBenchmarkGridVisible, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-run-execution";

test.describe("demo: benchmark run execution", () => {
  test("records the non-mutating start and retry controls for benchmark runs", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expectBenchmarkGridVisible(page);
    await pauseForDemo();

    await hoverFirstVisible(page, /^start-infinite-/);
    await scrollToText(page, /start|try eval|retry|running|pending/i);

    await saveDemoVideo(page, TOPIC);
  });
});