import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-overview";

test.describe("demo: dashboard overview", () => {
  test("records the analytics dashboard", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);

    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in, then tour the loaded carousels so the
    // populated dashboard — not the shimmer — dominates the clip.
    await settleLoaded(page, {
      hoverTestIds: [
        "dashboard-header-carousel-next",
        "dashboard-primary-carousel-next",
        "dashboard-secondary-carousel-next",
      ],
    });

    await saveDemoVideo(page, TOPIC);
  });
});