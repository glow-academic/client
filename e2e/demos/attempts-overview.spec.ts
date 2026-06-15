import { expect, type Page, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "attempts-overview";

// coverage: full-page tour of the learner /home — assigned-simulation progress
// bars, the launch-card carousel (page through it), each card's read-only
// "View Rubrics" dialog, the analytics-toolbar filter popovers + date range,
// and the attempt-history table (search + faceted filters + scores). Every beat
// past the home-overview ready-assertion no-ops if its target is absent, and
// nothing is committed/confirmed — pickers open then dismiss with Escape, the
// history search is typed then cleared, so the live instance is untouched.

/** Open a popover/dialog trigger if present, hold so its content reads, Escape. */
async function peekAndDismiss(page: Page, trigger: ReturnType<Page["locator"]>): Promise<void> {
  const target = trigger.first();
  if (!(await target.isVisible().catch(() => false))) return;
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click().catch(() => undefined);
  await pauseForDemo(1_100);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(500);
}

test.describe("demo: attempts overview", () => {
  test("records assigned simulations, attempt progress, and attempt history", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in so the populated deck — not the shimmer —
    // opens the clip, then settle on the welcome header + first progress rows.
    await settleLoaded(page, {
      scrollTexts: [/welcome back/i],
      hoverTestIds: [/^simulation-progress-/],
    });

    // --- Analytics toolbar: read-only view filters (open → reveal → Escape) ---
    // These re-scope the page; opening the popover and dismissing commits nothing.
    for (const label of ["Attempts", "Roles", "Cohorts", "Departments"]) {
      await peekAndDismiss(page, page.getByRole("button", { name: label, exact: true }));
    }
    // Date-range picker (button id="date", "Filter by date" when empty).
    await peekAndDismiss(page, page.locator("#date"));

    // --- Progress section: scroll the grouped attempt-progress bars ---
    await hoverFirstVisible(page, /^simulation-progress-/);
    await scrollToText(page, /passed|in progress|not started|to pass/i);

    // --- Launch-card carousel: tour cards, then page through it ---
    await hoverFirstVisible(page, "simulation-title");
    await hoverFirstVisible(page, "simulation-duration");

    // The "View Rubrics" table-icon dialog on a card — read-only, open + Escape.
    await peekAndDismiss(
      page,
      page.getByRole("button", { name: /view rubrics/i }),
    );

    // Carousel next/prev: the header chevrons sit beside the "N of M" counter.
    // Click next if a second page exists, then return — both are read-only.
    const carouselPager = page.getByText(/^\s*1 of \d+\s*$/).first();
    if (await carouselPager.isVisible().catch(() => false)) {
      const navButtons = carouselPager.locator("xpath=../button");
      const nextBtn = navButtons.last();
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click().catch(() => undefined);
        await pauseForDemo(1_000);
        const prevBtn = navButtons.first();
        await prevBtn.click().catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // --- Attempt-history table: search, faceted filters, scores ---
    await scrollToText(page, /score|simulation|scenario|continue|retry|history/i);

    const historySearch = page
      .getByPlaceholder(/search by name, simulation, or scenarios/i)
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click().catch(() => undefined);
      await historySearch.pressSequentially("office", { delay: 55 });
      await pauseForDemo(1_100);
      await historySearch.fill("");
      await historySearch.press("Enter").catch(() => undefined);
      await pauseForDemo(900);
    }

    // Faceted history filters render as buttons carrying their title text.
    for (const label of ["Name", "Simulation", "Scenario"]) {
      await peekAndDismiss(page, page.getByRole("button", { name: label, exact: true }));
    }

    // Final hold on a populated history row so the clip ends substantive.
    await scrollToText(page, /score|%|view|continue|retry/i);
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
