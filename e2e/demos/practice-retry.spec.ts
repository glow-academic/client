import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-retry";

// # coverage: practice-retry — tour the RETRY entry-point on /practice STRICTLY
// READ-ONLY. Scroll past the simulation carousel into the SimulationHistory
// table, read a past-attempt row (View/Continue + score badge), then reveal
// the per-row Retry affordance (the RotateCcw icon button, aria-label="Retry",
// shown only on attempts owned by the current profile) by HOVERING it so its
// "Retry" tooltip reads — but NEVER clicking it: a click calls
// handleStartSimulation and would launch a live attempt. We also type-then-
// clear the history search and open the Score sort-header dropdown + a faceted
// view-filter popover, dismissing with Escape WITHOUT committing. Every beat
// past the one page-ready assertion no-ops if its target is absent. Distinct
// from practice-scores (dwells on score badges/filters) — this one centers the
// Retry button as the re-attempt entry point.

test.describe("demo: practice retry", () => {
  test("records the retry entry-point on past attempts without launching one", async ({
    page,
  }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);

    // The one stable page-ready anchor. Everything past here is guarded.
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({
      timeout: 30_000,
    });
    // Clear the loading shimmer so the populated screen — not a skeleton —
    // fills the opening frames.
    await settleLoaded(page);

    // Scroll down PAST the carousel into the past-attempt history table. Anchor
    // on the history search and the "Score" column so the rows are on frame
    // before we reveal the retry entry-point.
    await scrollToText(page, /search by name, simulation, or scenarios/i);
    await scrollToText(page, /^score$/i);
    await pauseForDemo(900);

    // Hover a past-attempt row's primary action (View / Continue) so a real
    // history row reads on screen — this is the context the Retry sits beside.
    const rowAction = page
      .getByRole("button", { name: /^view$/i })
      .or(page.getByRole("button", { name: /^continue$/i }))
      .first();
    await hoverLocatorIfVisible(rowAction);

    // THE retry entry-point: the per-row Retry icon button (aria-label="Retry",
    // RotateCcw). HOVER it to surface its "Retry" tooltip so the re-attempt
    // affordance reads — but we DO NOT click it (a click would launch a live
    // simulation). Strictly read-only.
    const retryButton = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await retryButton.hover().catch(() => undefined);
      // Hold so the "Retry" tooltip animates in and reads on frame.
      await pauseForDemo(1_200);
      // Read the tooltip content explicitly if it materialised.
      await scrollToText(page, /^retry$/i);
      await pauseForDemo(700);
    }

    // Type into the history search so the typing animates, let the table react,
    // then clear it — read-only, fully reset (no committed query).
    const historySearch = page
      .getByPlaceholder(/search by name, simulation, or scenarios/i)
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click();
      await historySearch.pressSequentially("retry", { delay: 55 });
      await pauseForDemo(1_000);
      await historySearch.fill("");
      await pauseForDemo(700);
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

    // Open one faceted view-filter popover (Simulation), reveal its options,
    // dismiss with Escape WITHOUT selecting anything (no committed filter →
    // non-destructive, self-resetting).
    const filterButton = page
      .getByRole("button", { name: /^simulation$/i })
      .first();
    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await filterButton.click().catch(() => undefined);
      await pauseForDemo(950);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(450);
    }

    // Show the pagination footer so the breadth of the retryable attempt
    // history reads as a final beat.
    await scrollToText(page, /rows per page|page \d+ of \d+/i);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
