// # coverage: focused tour of the /analytics/reports SUMMARY/overview band —
// the headline per-profile metric columns at the top of the loaded report (Avg
// Score, Highest, Completion, First Pass, Msgs/Sess, Time Spent, Attempts) and
// the detail HOVERCARDS those metric values reveal. We bring the metric band
// into view, hover the top-ranked profile rows so the cursor visibly tracks the
// leaderboard summary, then dwell on individual metric cells so their hover
// detail cards (mean/median/mode, completed/total, top scores, etc.) surface and
// read. We also open + Escape the metric column-header sort menus and the View
// column-visibility dropdown to reveal which summary metrics the band can show —
// all read-only, open-then-Escape. Distinct from reports-overview (full toolbar +
// faceted-filter + search tour), reports-history, reports-trends, and
// reports-leaderboard-section. Every beat past the one page-ready assertion is
// guarded (isVisible().catch) + non-destructive: no row clicked through, no sort
// committed, no column toggled, no filter applied, nothing mutated.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-overview-section";

test.describe("demo: reports overview section", () => {
  test("tours the reports summary metric band and its per-metric detail hovercards", async ({
    page,
  }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    // The loaded reports view carries `reports-table-container`; the loading
    // state renders skeletons (detached once data lands). Single page-ready
    // assertion — keep exactly one.
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in so the captured frames are the populated
    // summary band, not the shimmer.
    await settleLoaded(page);

    // BEAT 1 — bring the headline metric band into view (the summary columns at
    // the top of the report) and hold so the per-profile metric values read.
    await scrollToText(page, /avg score|highest|completion|first pass|attempts|time spent/i);
    await pauseForDemo(1_200);

    // BEAT 2 — hover the top-ranked profile row so the cursor lands on the
    // leaderboard summary's first entry (highest avg score, the report sorts
    // desc by default). Read-only hover.
    await hoverFirstVisible(page, /^reports-profile-row-/);
    await pauseForDemo(1_100);

    // BEAT 3 — dwell on individual headline metric VALUES so their detail
    // hovercards surface and read. Each populated metric cell wraps its value in
    // a HoverCard whose content lists the breakdown (Avg Score → mean/median/
    // mode; Completion → completed/total + rate; Highest → top scores; Attempts →
    // attempts + unique sims). We hover the value text in turn, holding past the
    // ~150ms open delay so each detail card opens on frame. All read-only.
    // Hover the percentage metric cells (Avg Score / Highest / Completion /
    // First Pass all render as "NN%") — the first few visible ones light up
    // their detail hovercards. Scoped to the table container so we hover summary
    // values, not stray percentages elsewhere.
    const container = page.getByTestId("reports-table-container");
    const percentCells = container.getByText(/^\d+%$/);
    const percentCount = await percentCells.count().catch(() => 0);
    for (let i = 0; i < Math.min(percentCount, 3); i++) {
      const cell = percentCells.nth(i);
      if (await cell.isVisible().catch(() => false)) {
        await cell.scrollIntoViewIfNeeded().catch(() => undefined);
        await cell.hover().catch(() => undefined);
        // Hold past the 150ms hovercard open delay so the detail card reads.
        await pauseForDemo(1_300);
      }
    }

    // BEAT 4 — hover a Time-Spent value (renders "NNm") and an Attempts value so
    // those summary metrics' detail cards (total minutes/hours; attempts +
    // unique sims) also surface. Guarded — absent in a thin report, clean no-op.
    const timeCell = container.getByText(/^\d+m$/).first();
    if (await timeCell.isVisible().catch(() => false)) {
      await timeCell.scrollIntoViewIfNeeded().catch(() => undefined);
      await timeCell.hover().catch(() => undefined);
      await pauseForDemo(1_300);
    }

    // BEAT 5 — open a summary metric column-header sort menu (e.g. "Avg Score")
    // to reveal the Asc / Desc / Hide options that reorder the headline band,
    // then dismiss with Escape WITHOUT committing a sort change. Reversible +
    // non-destructive.
    const sortHeader = page
      .getByRole("button", { name: /avg score|highest|completion|attempts/i })
      .first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await sortHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 6 — open the "View" column-visibility dropdown to reveal which
    // summary metrics the band can show/hide (Avg Score, Highest, Response Time,
    // Stagnation, ...), then dismiss with Escape. Read-only reveal: opened +
    // Escape, no column actually toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // End held on the populated summary metric band — substantive content on
    // frame.
    await scrollToText(page, /avg score|highest|attempts|time spent/i);
    await hoverFirstVisible(page, /^reports-profile-row-/);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
