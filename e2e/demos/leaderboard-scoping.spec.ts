// # coverage: full-page tour of /leaderboard focused on the SCOPING controls —
// the toolbar's scope pickers that narrow WHO the board ranks: Attempts
// (general/practice/archived), Roles, Cohorts, Departments, and the date-range
// filter. Distinct from leaderboard-trends (accolade momentum) and
// leaderboard-rankings (the ranked table). We settle out the skeleton, then
// walk the toolbar left-to-right: open EACH scope picker, reveal its searchable
// option list (type into the picker's own "Search ..." box so the filtering
// shows, clear it), and dismiss with Escape WITHOUT committing a selection — so
// the URL params / queried scope never change. Then we open the date-range
// calendar popover, hold so the two-month range UI reads, and Escape without
// picking a range. Finally we glance down the board so it's clear these
// controls scope a live leaderboard. Every beat past the one page-ready
// assertion is guarded (isVisible().catch) — a board whose server-driven field
// visibility hides a given picker, or a mobile layout that shows only the date
// picker, is a clean no-op — and strictly non-destructive (open-then-Escape;
// no option is selected, no date committed, no Reset/Refresh/Export clicked).
import { expect, test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-scoping";

/**
 * Open one toolbar scope picker (a `role="combobox"` button carrying the given
 * aria-label), reveal its searchable option list, optionally type into the
 * picker's own search box so the filtering animates, then dismiss with Escape.
 *
 * Fully guarded: the picker only renders when the server marks its field
 * visible AND it has options, and on mobile the toolbar shows only the date
 * picker — so an absent trigger is a clean no-op. Strictly non-destructive: no
 * `CommandItem` is selected, so the queried scope (URL params) never changes.
 */
async function tourScopePicker(
  page: Page,
  triggerLabel: RegExp,
  searchPlaceholder: RegExp,
  typeText: string,
): Promise<void> {
  const trigger = page.getByRole("combobox", { name: triggerLabel }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  // Hold while the popover springs open and its option list renders.
  await pauseForDemo(1_100);

  // Type into the picker's OWN search box so the option list visibly filters,
  // then clear it so the full set returns — reversible, nothing selected.
  const search = page.getByPlaceholder(searchPlaceholder).first();
  if (await search.isVisible().catch(() => false)) {
    await search.pressSequentially(typeText, { delay: 55 }).catch(() => undefined);
    await pauseForDemo(1_200);
    await search.fill("").catch(() => undefined);
    await pauseForDemo(900);
  } else {
    // No search box surfaced (e.g. the compact Attempts list) — still hold so
    // the revealed options read.
    await pauseForDemo(1_000);
  }

  // Dismiss WITHOUT committing a selection — scope stays exactly as it was.
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(900);
}

test.describe("demo: leaderboard scoping", () => {
  test("tours the cohort / department / role / attempt scope pickers and the date-range filter", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    // The loaded board carries `leaderboard-container`; the loading state is
    // `leaderboard-skeleton`, so this resolves uniquely to the populated view.
    // This is the single real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in so no shimmer frame is captured, then hold
    // a beat on the populated board before touching the toolbar.
    await settleLoaded(page);

    // BEAT 1 — Attempts scope: narrow which attempt KINDS feed the board
    // (general / practice / archived). Open the picker, let its options read,
    // Escape without changing the mode.
    await tourScopePicker(page, /select content type/i, /search attempts/i, "prac");

    // BEAT 2 — Roles scope: narrow the board to a role tier (the "who counts"
    // axis). Open, type to filter the role list, clear, Escape — uncommitted.
    await tourScopePicker(page, /select roles/i, /search roles/i, "st");

    // BEAT 3 — Cohorts scope: the headline scoping control — restrict the board
    // to one or more cohorts. Open, type into the cohort search so it filters,
    // clear, Escape. No cohort selected, so the leaderboard scope is unchanged.
    await tourScopePicker(page, /select cohorts/i, /search cohorts/i, "co");

    // BEAT 4 — Departments scope: the broadest org axis — restrict to a
    // department. Open, type to filter, clear, Escape — nothing committed.
    await tourScopePicker(page, /select departments/i, /search departments/i, "de");

    // BEAT 5 — Date-range scope: open the calendar popover so the two-month
    // range picker reads (the "when" axis that bounds the ranked window). Hold
    // so the calendar is on frame, then Escape WITHOUT selecting a range — the
    // queried window stays at its default. The trigger reads "Filter by date"
    // when unset; match it loosely so an already-set range still resolves.
    const dateBtn = page
      .getByRole("button", { name: /filter by date|\d{4}/i })
      .first();
    if (await dateBtn.isVisible().catch(() => false)) {
      await dateBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateBtn.click().catch(() => undefined);
      // Hold while the calendar popover opens and both months render.
      await pauseForDemo(1_400);
      // Glance at a month/day heading so it's clear this is a date range, not a
      // dropdown — guarded so an absent calendar is a no-op.
      await scrollToText(page, /Mo|Su|January|February|March|April|May|June|July|August|September|October|November|December/i);
      await pauseForDemo(900);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 6 — drop back to the board itself so it's clear these controls scope
    // a live, populated leaderboard. Glance across the accolade grid / ranked
    // table the scope feeds. Read-only — just settling the clip on content.
    await scrollToText(page, /perfect score|highest scorer|rapid riser|attempts|highest score/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
