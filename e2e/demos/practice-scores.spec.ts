import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-scores";

// # coverage: practice-scores — tour the SCORES / past-attempt history section on
// /practice. Scroll down past the simulation carousel to the SimulationHistory
// table, read score badges, type-then-clear the history search, open each
// faceted view-filter popover (Name / Simulation / Scenarios / Mode) and the
// Score column-header sort dropdown, revealing options and dismissing with
// Escape WITHOUT committing. Strictly non-destructive: no simulation start, no
// sort/filter committed, no archive. Every beat past the one page-ready
// assertion no-ops if its target is absent. Distinct from practice-overview
// (which dwells on the cards) — this one stays on the results history.

test.describe("demo: practice scores", () => {
  test("records score badges and past-attempt history context", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);

    // The one stable page-ready anchor. Everything past here is guarded.
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({
      timeout: 30_000,
    });
    // Clear the loading shimmer so the populated screen — not a skeleton —
    // fills the opening frames.
    await settleLoaded(page);

    // Scroll down PAST the carousel into the scores/history section. Anchor on
    // the history search box and the "Score" column header so the table is on
    // frame before we exercise it.
    await scrollToText(page, /search by name, simulation, or scenarios/i);
    await scrollToText(page, /^score$/i);
    await pauseForDemo(900);

    // Hover a score badge (high/medium/low colored % pill, or "Not graded")
    // so a real past-attempt result reads on screen.
    const scoreBadge = page
      .locator("text=/^\\d{1,3}%$/")
      .or(page.getByText(/^not graded$/i))
      .first();
    await hoverLocatorIfVisible(scoreBadge);

    // Type into the history search so the typing animates, let the table
    // react, then clear it — read-only, fully reset.
    const historySearch = page
      .getByPlaceholder(/search by name, simulation, or scenarios/i)
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click();
      await historySearch.pressSequentially("reading", { delay: 55 });
      await pauseForDemo(1_000);
      await historySearch.fill("");
      await pauseForDemo(700);
    }

    // Open each faceted view-filter popover, reveal its options, dismiss with
    // Escape WITHOUT selecting anything (no committed filter → non-destructive,
    // self-resetting). Each is a popover-trigger button labelled by its title.
    for (const label of [/^name$/i, /^simulation$/i, /^scenarios$/i, /^mode$/i]) {
      const filterButton = page.getByRole("button", { name: label }).first();
      if (await filterButton.isVisible().catch(() => false)) {
        await filterButton.scrollIntoViewIfNeeded().catch(() => undefined);
        await filterButton.click().catch(() => undefined);
        await pauseForDemo(950);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(450);
      }
    }

    // Open the Score column-header sort dropdown to reveal Asc/Desc options,
    // then Escape WITHOUT choosing — the sort stays as-is (no re-query
    // committed). The header is a sortable button labelled "Score".
    const scoreHeader = page.getByRole("button", { name: /^score$/i }).first();
    if (await scoreHeader.isVisible().catch(() => false)) {
      await scoreHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await scoreHeader.click().catch(() => undefined);
      await pauseForDemo(950);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(450);
    }

    // Show the pagination footer ("Page N of M") so the breadth of the
    // attempt history reads as a final beat.
    await scrollToText(page, /rows per page|page \d+ of \d+/i);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
