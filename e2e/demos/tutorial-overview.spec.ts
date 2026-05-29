import { test } from "@playwright/test";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: tutorial overview", () => {
  test("walk the full build path: rubric, persona, scenario, simulation, cohort", async ({ page }) => {
    test.setTimeout(180_000);
    for (const [route, anchor] of [
      ["/platform/rubrics/new", /sales call rubric|pass points/i],
      ["/training/personas/new", /enthusiastic student|instructions/i],
      ["/training/scenarios/new", /customer support|describe the scenario/i],
      ["/training/simulations/new", /simulation name|scenarios/i],
      ["/training/cohorts/new", /spring 2024|description/i],
    ] as const) {
      await page.goto(route);
      await expectAuthenticated(page);
      await pauseForDemo();
      await scrollToText(page, anchor).catch(() => undefined);
    }
    await saveDemoVideo(page, "tutorial-overview");
  });
});
