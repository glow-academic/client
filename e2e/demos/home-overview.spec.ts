import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-overview";

// coverage: the canonical learner-home OVERVIEW — tour the whole page as a
// cohesive whole: the welcome header, the simulation-progress summary strip,
// and the launch-card carousel. Scroll top->bottom, hover the progress bars +
// cards, page the carousel via its chevrons. Every beat past the one
// page-ready assertion no-ops if its target is absent, and we NEVER start a
// simulation (no click on start-simulation-*).

/** Hover each visible match of a testid pattern in DOM order, holding a beat. */
async function hoverEach(page: Page, testId: RegExp, max = 4): Promise<void> {
  const all = page.getByTestId(testId);
  const count = await all.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, max); i++) {
    await hoverLocatorIfVisible(all.nth(i));
  }
}

/** The carousel pager button next to the "N of M" label, by direction. */
function carouselPager(page: Page, dir: "prev" | "next"): Locator {
  // The pager lives in a flex row that contains the "N of M" span; the prev
  // button precedes the span and the next button follows it. Scope to that row
  // so we don't grab unrelated chevrons elsewhere on the page.
  const row = page
    .locator("div", { has: page.getByText(/\d+ of \d+/) })
    .filter({ has: page.locator("button") })
    .last();
  const buttons = row.locator("button");
  return dir === "prev" ? buttons.first() : buttons.last();
}

/** Click a carousel pager if it exists and is enabled; settle so the new page reads. */
async function pageCarousel(page: Page, dir: "prev" | "next"): Promise<void> {
  const btn = carouselPager(page, dir);
  if (!(await btn.isVisible().catch(() => false))) return;
  if (await btn.isDisabled().catch(() => true)) return;
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await btn.click().catch(() => undefined);
  await pauseForDemo(900);
}

test.describe("demo: home overview", () => {
  test("records the learner home page", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);

    // The ONE page-ready assertion. Everything after is guarded.
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in so the LOADED overview fills the frame.
    await settleLoaded(page);

    // 1) Welcome header — top of the page, the personal greeting.
    await scrollToText(page, /Welcome back/i);

    // 2) Simulation-progress summary strip — hover the progress bars so their
    //    completion / pass breakdown reads as the at-a-glance status section.
    await hoverEach(page, /^simulation-progress-/);

    // 3) Launch-card carousel — scroll it into view, hover a couple of cards so
    //    their title + duration + standards surface (without launching either).
    await scrollToText(page, /\d+ of \d+/);
    await hoverEach(page, /^simulation-card-/, 3);

    // 4) Page the carousel forward then back via its chevrons, holding on each
    //    page so the distinct card set + "N of M" counter change is visible.
    await pageCarousel(page, "next");
    await hoverEach(page, /^simulation-card-/, 3);
    await pageCarousel(page, "prev");

    // 5) A closing beat back on the progress strip so the clip ends on the
    //    cohesive overview rather than mid-scroll.
    await hoverLocatorIfVisible(page.getByTestId(/^simulation-progress-/).first());

    await saveDemoVideo(page, TOPIC);
  });
});
