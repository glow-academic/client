import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: full read-only tour of the activity audit-log / session-replay
// surface (/analytics/activity) — header metrics, profile summary, problems,
// session-history search + faceted Profile filter + date-range picker +
// pagination + a hovered session row (the drill-in into a session's replay).
// Every beat past the single page-ready assertion is guarded so it no-ops if
// its target is absent. Strictly non-destructive: filters/pickers are
// opened then dismissed with Escape, the search is typed then cleared, and
// no row is clicked (drill-in would navigate away mid-clip).
const TOPIC = "audit-replay";

test.describe("demo: audit replay", () => {
  test("tours the activity audit log and session-replay history read-only", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);

    // Single real page-ready assertion: a broken audit surface still surfaces here.
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });

    // Open on the LOADED, populated audit view (skeleton trimmed by settle),
    // hovering the header metric cards so the clip opens on real numbers.
    await settleLoaded(page, { hoverTestIds: ["activity-metrics"] });

    // Beat 1 — the engagement / audit metric cards (sessions, profiles, logins,
    // emulations) that summarize what the audit log is counting.
    if (await page.getByTestId("activity-metrics").isVisible().catch(() => false)) {
      await page.getByTestId("activity-metrics").scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // Beat 2 — the per-profile activity summary panel.
    await scrollToText(page, /active profiles|logins|emulations|profile/i);
    await hoverFirstVisible(page, "activity-profile-summary");
    await pauseForDemo(1_100);

    // Beat 3 — the problems / flagged-issues panel (the audit "attention" feed).
    await scrollToText(page, /problems|attention|flagged|issues/i);
    await hoverFirstVisible(page, "activity-problems");
    await pauseForDemo(1_100);

    // Beat 4 — scroll to the session-history table, the replay drill-in surface.
    await scrollToText(page, /Search sessions|session/i);
    await pauseForDemo(900);

    // Beat 5 — open the toolbar date-range picker to show the audit log is
    // time-scopable, then dismiss WITHOUT committing a range (non-destructive).
    const dateFilter = page.getByRole("button", { name: /Filter by date|date/i }).first();
    if (await dateFilter.isVisible().catch(() => false)) {
      await dateFilter.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // Beat 6 — type into the session search so the audit table visibly re-queries,
    // let it react, then clear it back to the full log (non-destructive).
    const search = page.getByTestId("activity-search");
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click();
      await search.pressSequentially("session", { delay: 55 });
      await pauseForDemo(1_400);
      await search.fill("");
      await pauseForDemo(900);
    }

    // Beat 7 — open the faceted Profile filter to show sessions can be scoped
    // per actor, reveal the options, then close it (no selection committed).
    const profileFilter = page.getByRole("button", { name: /Profile/i }).first();
    if (await profileFilter.isVisible().catch(() => false)) {
      await profileFilter.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // Beat 8 — surface a single session row (the click target that drills into
    // that session's full replay). We hover only — clicking would navigate away
    // mid-clip — so the recording stays on the audit history table.
    if (await page.getByTestId("activity-sessions-table").isVisible().catch(() => false)) {
      await page.getByTestId("activity-sessions-table").scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
      await hoverFirstVisible(page, /^activity-session-row-/);
      await pauseForDemo(1_300);
    }

    // Beat 9 — open the rows-per-page selector to show the audit log paginates,
    // then dismiss without changing the page size (non-destructive). The Radix
    // trigger is a combobox whose accessible name is the current page-size
    // number, so we locate it via the adjacent "Rows per page" label region
    // rather than by name, and bail (no-op) if pagination isn't rendered.
    const pageSizeSelect = page
      .getByText(/rows per page/i)
      .first()
      .locator("xpath=following::*[@role='combobox'][1]");
    if (await pageSizeSelect.isVisible().catch(() => false)) {
      await pageSizeSelect.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSizeSelect.click();
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
