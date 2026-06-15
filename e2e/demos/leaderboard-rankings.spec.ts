// # coverage: full-page tour of /leaderboard focused on the RANKINGS table —
// scrolls the accolade grid into view, then settles on the ranked table and
// tours its substance: medal-ranked top rows (hover, no click — a row click
// navigates to a report, so rows are hover-only), the per-metric columns
// (Highest Score / Time Spent / Msgs per Session / Perfect Scores / Attempts),
// the name search (type/clear), the "View" column-visibility dropdown that
// reveals the hidden metric columns (Quickest Pass / Improvement / Response
// Times), two sortable column-header menus (open/reveal Asc·Desc·Hide/Escape),
// and the date-range calendar popover in the toolbar (open/reveal months/
// Escape). Every beat past the one page-ready assertion is guarded + non-
// destructive: search is reversible view state; dropdowns/popovers/sort menus
// are open-then-Escape so no sort, column toggle, or date filter is committed.
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-rankings";

test.describe("demo: leaderboard rankings", () => {
  test("tours the ranked table — medal rows, metric columns, view toggle, sort menus, and date range", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    // The loaded board carries `leaderboard-container`; the loading state is
    // `leaderboard-skeleton`, so this resolves uniquely to the populated view.
    // This is the single real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in so no shimmer frame is captured, then hold
    // a beat on the populated board.
    await settleLoaded(page);

    // BEAT 1 — glance across the accolade (trophy) grid at the top so the page
    // header reads, then move down toward the ranking table.
    await hoverFirstVisible(page, /^accolade-/);
    await pauseForDemo(900);

    // BEAT 2 — bring the ranked table into view and let its toolbar + rows
    // settle on frame. This is the centerpiece of the rankings clip.
    await expect(page.getByTestId("leaderboard-table")).toBeVisible();
    await scrollToText(page, /search users|rank|highest score|attempts/i);
    await pauseForDemo(1_200);

    // BEAT 3 — hover the top-ranked rows so the medal placements (🥇🥈🥉) and
    // the per-metric columns register as the cursor tracks down the ranking.
    // Hover-only — a row click navigates to that profile's report, so we never
    // click. Guarded so a thin board (few rows) is a clean no-op.
    const rows = page.getByTestId(/^leaderboard-row-/);
    const rowCount = await rows.count().catch(() => 0);
    for (let i = 0; i < Math.min(rowCount, 3); i++) {
      const row = rows.nth(i);
      if (await row.isVisible().catch(() => false)) {
        await row.scrollIntoViewIfNeeded().catch(() => undefined);
        await row.hover().catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // BEAT 4 — let the metric column headers read across the table (Highest
    // Score, Time Spent, Msgs/Session, Perfect Scores, Attempts).
    await scrollToText(page, /highest score|time spent|msgs|perfect|attempts/i);
    await pauseForDemo(1_100);

    // BEAT 5 — type into the name search so the ranking visibly narrows to a
    // single user, let the rows react, then clear it so the full ranking
    // returns. Reversible view state — nothing committed.
    const search = page.getByPlaceholder("Search users by name...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 6 — open the "View" column-visibility dropdown to reveal the
    // toggle-columns list (the hidden metrics — Quickest Pass, Daily
    // Improvement, Response Times — that can join the ranking), then dismiss
    // with Escape. Read-only reveal: opened + Escape, no column toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 7 — open the "Highest Score" column-header sort menu to reveal the
    // Asc / Desc / Hide options the ranking can be re-sorted by, then dismiss
    // with Escape WITHOUT committing a sort change. Reversible + non-destructive.
    const scoreHeader = page
      .getByRole("button", { name: /highest score/i })
      .first();
    if (await scoreHeader.isVisible().catch(() => false)) {
      await scoreHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 8 — open a second sortable header (Attempts / Time Spent) so the
    // sort affordance reads as a general column capability, then Escape.
    const attemptsHeader = page
      .getByRole("button", { name: /^Attempts$|time spent/i })
      .first();
    if (await attemptsHeader.isVisible().catch(() => false)) {
      await attemptsHeader.click().catch(() => undefined);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 9 — open the toolbar date-range picker to reveal the two-month
    // calendar the ranking window is scoped by, then dismiss with Escape
    // WITHOUT picking a range (no date filter committed). Guarded so a toolbar
    // without the picker is a clean no-op.
    const dateBtn = page.getByRole("button", { name: /filter by date|\d{4}/i }).first();
    if (await dateBtn.isVisible().catch(() => false)) {
      await dateBtn.click().catch(() => undefined);
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // End held on the populated ranking — substantive content on frame.
    await scrollToText(page, /highest score|rank|attempts/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
