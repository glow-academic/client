import { test } from "@playwright/test";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: patterns overview", () => {
  test("tour the pattern catalog across personas, rubrics, simulations", async ({ page }) => {
    test.setTimeout(180_000);
    for (const [route, anchor] of [
      ["/training/personas", /persona|instructions|voice/i],
      ["/platform/rubrics", /rubric|standard|points/i],
      ["/training/simulations", /simulation|scenario|order/i],
    ] as const) {
      await page.goto(route);
      await expectAuthenticated(page);
      await pauseForDemo();
      await scrollToText(page, anchor).catch(() => undefined);
    }
    await saveDemoVideo(page, "patterns-overview");
  });
});
