// # coverage: full-page tour of /analytics/reports — the analytics toolbar
// (Attempts/Roles/Cohorts/Departments scope pickers + the date-range popover,
// each open/reveal/Escape), the reports table scroll (toolbar + profile rows +
// per-profile metric columns), the profile name search (type/clear), the Name +
// Scenario + Simulation faceted-filter popovers (open/reveal/CommandInput/
// Escape), the View column-toggle dropdown (open/reveal/Escape), and a sortable
// metric column-header sort menu (open/reveal/Escape). Every beat past the one
// page-ready assertion is guarded + non-destructive (every picker/search/sort is
// read-only view state; popovers/menus are open-then-Escape; nothing is
// committed, no date selected, no filter applied, no row mutated).
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-overview";

test.describe("demo: reports overview", () => {
  test("tours the reports analytics toolbar, table, search, faceted filters, view options, and sort menu", async ({
    page,
  }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    // The loaded reports view carries `reports-table-container`; the loading
    // state renders skeletons (detached once data lands). This is the single
    // real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in and hold a beat on the populated report.
    await settleLoaded(page);

    // BEAT 1 — open the analytics-toolbar "Attempts" scope picker (general /
    // practice / archived) to reveal the modes the report can be scoped by, then
    // dismiss with Escape WITHOUT changing the selection. Read-only reveal.
    const attemptsPicker = page.getByRole("button", { name: /Attempts/i }).first();
    if (await attemptsPicker.isVisible().catch(() => false)) {
      await attemptsPicker.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 2 — open the cohort / department / role scope pickers in turn (each
    // server-driven, so any absent one is a clean no-op), revealing the
    // population the report can be narrowed to, dismissing each with Escape so
    // nothing is committed.
    for (const label of [/Roles/i, /Cohorts/i, /Departments/i]) {
      const picker = page.getByRole("button", { name: label }).first();
      if (await picker.isVisible().catch(() => false)) {
        await picker.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // BEAT 3 — open the date-range popover (the toolbar `#date` button, showing
    // the active 30-day window) to reveal the range calendar, then dismiss with
    // Escape WITHOUT picking a day — selecting a day would re-query, so this is
    // an open-then-close reveal only, leaving the window unchanged.
    const dateBtn = page.locator("#date").first();
    if (await dateBtn.isVisible().catch(() => false)) {
      await dateBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateBtn.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 4 — tour the loaded reports table: bring the toolbar + per-profile
    // metric columns into view and hover the first profile row so the cursor
    // visibly tracks across the populated leaderboard rows.
    await scrollToText(page, /avg score|highest|completion|attempts|first pass|time spent/i);
    await pauseForDemo(1_000);
    await hoverFirstVisible(page, /^reports-profile-row-/);
    await pauseForDemo(1_000);

    // BEAT 5 — type into the profile name/email search so the table visibly
    // filters live, let the rows react, then clear it so the report returns to
    // the full population. Reversible view state.
    const search = page.getByPlaceholder("Search profiles by name or email...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 6 — open the "Name" faceted-filter popover to reveal its searchable
    // profile-option list, type into the popover's CommandInput so the option
    // list narrows, then dismiss with Escape WITHOUT selecting (no committed
    // filter). Scoped to the popover trigger so it never collides with the
    // "Name" sortable column header. Guarded so a report without this filter
    // is a clean no-op.
    const nameFilter = page.getByRole("button", { name: /^Name$/ }).last();
    if (await nameFilter.isVisible().catch(() => false)) {
      await nameFilter.click().catch(() => undefined);
      await pauseForDemo(1_100);
      const nameSearch = page.getByPlaceholder("Name").first();
      if (await nameSearch.isVisible().catch(() => false)) {
        await nameSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 7 — open the "Scenario" then "Simulation" faceted-filter popovers to
    // reveal the activities the report can be scoped by, dismissing each with
    // Escape. Open + Escape only — a non-destructive reveal of available scoping
    // options, nothing applied.
    for (const label of [/^Scenario$/, /^Simulation$/]) {
      const facet = page.getByRole("button", { name: label }).first();
      if (await facet.isVisible().catch(() => false)) {
        await facet.click().catch(() => undefined);
        await pauseForDemo(1_200);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // BEAT 8 — open the "View" column-visibility dropdown to reveal the
    // toggle-columns list (which metrics show in the table), then dismiss.
    // Read-only reveal: opened + Escape, no column actually toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 9 — open a sortable metric column-header sort menu (e.g. "Avg Score")
    // to reveal the Asc / Desc / Hide options, then dismiss with Escape without
    // committing a sort change. Reversible + non-destructive.
    const sortHeader = page
      .getByRole("button", { name: /avg score|highest|completion|attempts/i })
      .first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // End held on the populated reports table — substantive content on frame.
    await scrollToText(page, /avg score|highest|attempts|time spent/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
