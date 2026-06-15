import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-bulk";

// coverage: full-page tour of the profiles management table. We orient on the
// toolbar, type into the name/email search (then clear), open EACH faceted
// filter popover (Role / Permissions / Department) and Escape, open the column
// "View" menu and Escape, then exercise the bulk path: multi-select rows via
// the header "select all" checkbox to flip the toolbar into bulk-action mode,
// OPEN the bulk-delete confirmation dialog and CANCEL (never confirming), and
// reveal the additive CSV Import dialog (open, hold, Escape). We also click
// through pagination if the dataset spans more than one page.
//
// HARD RULES: every beat is NON-DESTRUCTIVE (open-then-cancel/Escape) and
// GUARDED — past the single page-ready assertion, a missing control makes the
// beat a no-op rather than failing the recording. The one hard assertion is
// the profiles-table ready-testid.
test.describe("demo: profiles bulk", () => {
  test("tour the profiles table, filters, search + reveal bulk delete & CSV import (non-destructive)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto("/management/profiles");
    await expectAuthenticated(page);
    // The one real page-ready assertion — a broken page still surfaces here.
    // Generous wait: the page loads up to 1000 rows SSR.
    await expect(page.getByTestId("profiles-table")).toBeVisible({ timeout: 40_000 });

    // Open on the LOADED, populated table (skeleton trimmed, beat held) so the
    // clip never starts on the washed-out fade-in shimmer.
    await settleLoaded(page);

    // Beat 1 — orient on the management toolbar (search + filters + actions).
    await hoverFirstVisible(page, "profiles-toolbar");
    await pauseForDemo(1_000);

    // Beat 2 — scroll the populated table into view and let a few rows read.
    await hoverFirstVisible(page, "profiles-row");
    await pauseForDemo(1_000);

    // Beat 3 — type into the name/email search so the typing shows + the table
    // re-filters live, then clear it so the full list returns.
    const search = page.getByTestId("profiles-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("admin", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(800);
    }

    // Beat 4 — open EACH faceted filter popover (Role / Permissions /
    // Department), reveal its options, and Escape WITHOUT committing a filter.
    for (const title of ["Role", "Permissions", "Department"]) {
      const filterBtn = page.getByRole("button", { name: new RegExp(`^${title}$`, "i") }).first();
      if (await filterBtn.isVisible().catch(() => false)) {
        await filterBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        await filterBtn.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    // Beat 5 — open the column "View" menu to show the toggle-columns options,
    // hold, then Escape (read-only, nothing toggled).
    const viewBtn = page.getByRole("button", { name: /^view$/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click().catch(() => undefined);
      await scrollToText(page, /toggle columns/i);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // Beat 6 — page through the table if the dataset spans more than one page.
    // Next then back to the first page so the view is reset. Guarded: disabled
    // (single-page) nav buttons no-op.
    const nextPage = page.getByRole("button", { name: /go to next page/i }).first();
    if ((await nextPage.isVisible().catch(() => false)) && (await nextPage.isEnabled().catch(() => false))) {
      await nextPage.scrollIntoViewIfNeeded().catch(() => undefined);
      await nextPage.click().catch(() => undefined);
      await pauseForDemo(1_100);
      const firstPage = page.getByRole("button", { name: /go to (first|previous) page/i }).first();
      if (await firstPage.isVisible().catch(() => false)) {
        await firstPage.click().catch(() => undefined);
        await pauseForDemo(900);
      }
    }

    // Beat 7 — multi-select the rows via the header "select all" checkbox. This
    // flips the toolbar into bulk-action mode (the delete/edit buttons appear).
    const selectAll = page.getByTestId("checkbox-select-all").first();
    if (await selectAll.isVisible().catch(() => false)) {
      await selectAll.scrollIntoViewIfNeeded().catch(() => undefined);
      await selectAll.click().catch(() => undefined);
      await pauseForDemo(1_300);
    }

    // Beat 8 — draw the eye to the now-revealed bulk delete + bulk edit actions.
    await hoverFirstVisible(page, "btn-bulk-edit-profiles");
    await hoverFirstVisible(page, "btn-bulk-delete-profiles");
    await pauseForDemo(900);

    // Beat 9 — OPEN the bulk-delete confirmation dialog to show the bulk action,
    // hold on it, then CANCEL. NON-DESTRUCTIVE: the delete is never confirmed.
    const bulkDelete = page.getByTestId("btn-bulk-delete-profiles").first();
    if (await bulkDelete.isVisible().catch(() => false)) {
      await bulkDelete.click().catch(() => undefined);
      const dialog = page.getByTestId("dialog-bulk-delete-profile").first();
      await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
      await pauseForDemo(1_500);
      // Cancel — back out without deleting anything.
      const cancel = page.getByRole("button", { name: /^cancel$/i }).first();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click().catch(() => undefined);
      } else {
        await page.keyboard.press("Escape").catch(() => undefined);
      }
      await pauseForDemo(900);
    }

    // Beat 10 — clear the selection so the CSV Import button returns, then OPEN
    // the import flow to show the additive bulk path, hold, and Escape to close.
    const unselect = page.getByRole("button", { name: /unselect all/i }).first();
    if (await unselect.isVisible().catch(() => false)) {
      await unselect.click().catch(() => undefined);
      await pauseForDemo(900);
    }
    const csvImport = page.getByRole("button", { name: /csv import/i }).first();
    if (await csvImport.isVisible().catch(() => false)) {
      await csvImport.click().catch(() => undefined);
      const importDialog = page.getByTestId("dialog-bulk-import").first();
      await importDialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
      await pauseForDemo(1_500);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
