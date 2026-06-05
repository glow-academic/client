import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-overview";

test.describe("demo: home overview", () => {
  test("records the learner home page", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);

    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in, then tour the loaded simulation deck.
    await settleLoaded(page, {
      hoverTestIds: [/^simulation-progress-/, /^start-simulation-/],
    });

    await saveDemoVideo(page, TOPIC);
  });
});