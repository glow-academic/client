import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-overview";

/** Advance a dashboard carousel a couple of slides, holding on each. */
async function tourCarousel(page: import("@playwright/test").Page, nextTestId: string, slides = 2): Promise<void> {
  const next = page.getByTestId(nextTestId).first();
  if (!(await next.isVisible().catch(() => false))) return;
  await next.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(1_100);
  for (let i = 0; i < slides; i++) {
    await next.click().catch(() => undefined);
    await pauseForDemo(1_300);
  }
}

test.describe("demo: dashboard overview", () => {
  test("records the analytics dashboard", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);

    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });

    // Open on the loaded dashboard (skeleton trimmed by settle).
    await settleLoaded(page);

    // Tour the sections by advancing each carousel through a couple of slides:
    // KPI header → primary (skill correlation) → secondary (persona performance).
    await tourCarousel(page, "dashboard-primary-carousel-next");
    await tourCarousel(page, "dashboard-secondary-carousel-next");
    await tourCarousel(page, "dashboard-header-carousel-next", 1);
    await pauseForDemo(1_200);

    await saveDemoVideo(page, TOPIC);
  });
});
