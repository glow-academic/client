import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-bulk";

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

// coverage: full-page tour of the personas library (persona card grid) top->
// bottom — orient on the management toolbar, scroll the populated cards, type
// into the name search (debounced server re-query) then clear, open EACH
// faceted picker popover (Scenario / Field / Department) revealing its
// command-search + options and Escape, open the "View" column-visibility menu
// and Escape, walk pagination next/prev, reveal the additive "Import CSV"
// dialog (open, hold, Escape), then exercise the BULK path non-destructively:
// click a card to flip the toolbar into selection mode, OPEN the bulk-delete
// confirm and CANCEL, OPEN the bulk-edit dialog (Active Status / Color / Icon /
// Departments / Voices) and CANCEL, then Unselect All so the clip ends on a
// clean, populated grid.
//
// HARD RULES (LIVE instance): every beat is NON-DESTRUCTIVE (open-then-
// cancel/Escape; the bulk-delete confirm `btn-confirm-bulk-delete` and the
// bulk-edit apply `btn-apply-bulk-edit` are NEVER clicked, no per-card
// Duplicate/Delete is ever invoked) and GUARDED — past the single page-ready
// assertion (`personas-grid`), a missing/absent control makes the beat a no-op
// rather than failing the recording. Card Edit/View links are only present
// inside cards we never click, so we never navigate off the list.

/** Click a locator if it is visible, then hold a demo beat. No-op when absent. */
async function clickIfVisible(target: Locator, hold = 1_100): Promise<boolean> {
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click().catch(() => undefined);
  await pauseForDemo(hold);
  return true;
}

/** Open a faceted picker popover by its trigger label, reveal its options, then
 *  dismiss with Escape — never commits a filter. No-op when absent. */
async function peekFilter(page: Page, label: RegExp): Promise<void> {
  const trigger = page.getByRole("button", { name: label }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  await pauseForDemo(1_200);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
}

test.describe("demo: personas bulk", () => {
  test("tour the personas grid, filters, search + reveal bulk delete/edit & CSV import (non-destructive)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Open on the personas library (clean, unselected — no selection params).
    await page.goto("/training/personas");
    await expectAuthenticated(page);

    // ONE real page-ready assertion: the card grid is the feature container.
    // Generous wait — the page SSR-loads the full persona list + filter facets.
    await expect(page.getByTestId("personas-grid")).toBeVisible({ timeout: 40_000 });

    // Trim the skeleton lead-in and hold on the populated grid so the clip
    // never opens on the washed-out fade-in shimmer.
    await settleLoaded(page);

    // BEAT 1 — orient on the management toolbar (search + filters + actions).
    const toolbar = page.getByTestId("personas-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await toolbar.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 2 — scroll the populated cards top->bottom so the whole grid reads.
    const cards = page.getByTestId("persona-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 0) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await cards
        .nth(Math.min(cardCount - 1, 5))
        .scrollIntoViewIfNeeded()
        .catch(() => undefined);
      await pauseForDemo(900);
      await cards.last().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 3 — type into the name search so the typing + server re-query shows,
    // let the debounce (500ms) fire and the list react, then clear it back to
    // the full grid. Read-only: an empty value re-commits the unfiltered list.
    const search = page.getByTestId("personas-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_400);
      await waitOutSkeleton(page);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(900);
      await waitOutSkeleton(page);
    }

    // BEAT 4 — open EACH faceted picker popover, reveal its command-search +
    // options, and Escape WITHOUT committing a filter (read-only peek). The
    // faceted-filter trigger's accessible name is its title.
    await peekFilter(page, /^Scenario$/);
    await peekFilter(page, /^Field$/);
    await peekFilter(page, /^Department$/);

    // BEAT 5 — open the "View" column-visibility menu to show the card-toggle
    // options (AI badge / status / description / counts), hold, then Escape
    // (nothing toggled).
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await clickIfVisible(viewBtn, 1_300)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 6 — walk pagination if the dataset spans more than one page: Next,
    // hold on the second page (settle out the SSR re-fetch skeleton), then
    // back. The card paginator uses sr-only "Go to next/previous page" labels.
    // Gate isEnabled() behind a visible + short-timeout check so an absent /
    // single-page paginator no-ops fast.
    const nextPage = page.getByRole("button", { name: /Go to next page/i }).first();
    if (
      (await nextPage.isVisible().catch(() => false)) &&
      (await nextPage.isEnabled({ timeout: 1_500 }).catch(() => false))
    ) {
      await clickIfVisible(nextPage, 1_000);
      await waitOutSkeleton(page);
      await pauseForDemo(700);
      const prevPage = page
        .getByRole("button", { name: /Go to (first|previous) page/i })
        .first();
      await clickIfVisible(prevPage, 1_000);
      await waitOutSkeleton(page);
    }

    // BEAT 7 — reveal the additive CSV Import flow: open the dialog, hold so its
    // content reads, then Escape to close. NON-DESTRUCTIVE (nothing imported).
    const csvImport = page.getByRole("button", { name: /Import CSV/i }).first();
    if (await clickIfVisible(csvImport, 1_500)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 8 — flip into selection mode by clicking a card. The card toggles its
    // selection (ring-2 + checkbox), swapping the toolbar in for the bulk-action
    // bar (Delete N of M / Edit N of M / Select Page / Unselect All). Guarded:
    // skips cleanly on an empty grid. Cards are clicked on their body (away from
    // the per-card action buttons), which only toggles selection — never opens
    // a destructive per-card action.
    const firstCard = cards.first();
    let selected = false;
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstCard.click({ position: { x: 12, y: 12 } }).catch(() => undefined);
      await pauseForDemo(1_300);
      selected = true;
    }

    if (selected) {
      // BEAT 9 — OPEN the bulk-delete confirm to show the destructive affordance,
      // hold on it, then CANCEL. NON-DESTRUCTIVE: btn-confirm-bulk-delete is
      // never clicked. The toolbar button reads "Delete N of M" (or "Delete N
      // matching" under all-matching mode).
      const bulkDelete = page
        .getByTestId("personas-toolbar")
        .getByRole("button", { name: /^Delete \d+/ })
        .first();
      if (
        (await bulkDelete.isVisible().catch(() => false)) &&
        (await bulkDelete.isEnabled().catch(() => false))
      ) {
        await bulkDelete.click().catch(() => undefined);
        const dialog = page.getByTestId("dialog-bulk-delete-persona").first();
        await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
        await pauseForDemo(1_500);
        const cancel = page.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        await pauseForDemo(1_000);
      }

      // BEAT 10 — OPEN the bulk-edit dialog to show the additive bulk-update
      // affordances (Active Status flag + Color / Icon / Departments / Voices
      // pickers), hold, then Cancel/Escape — no apply. NON-DESTRUCTIVE:
      // btn-apply-bulk-edit is never clicked.
      const bulkEdit = page
        .getByTestId("personas-toolbar")
        .getByRole("button", { name: /^Edit \d+/ })
        .first();
      if (
        (await bulkEdit.isVisible().catch(() => false)) &&
        (await bulkEdit.isEnabled().catch(() => false))
      ) {
        await bulkEdit.click().catch(() => undefined);
        const editDialog = page.getByTestId("dialog-bulk-edit").first();
        await editDialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
        await pauseForDemo(1_600);
        const cancel = editDialog.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        await pauseForDemo(900);
      }

      // BEAT 11 — clear the selection so the clip ends on a clean, populated
      // grid — never a half-selected or filtered state.
      const unselect = page.getByRole("button", { name: /^Unselect All$/ }).first();
      await clickIfVisible(unselect, 900);
    }

    // End on the substantive, populated grid.
    await expect(page.getByTestId("personas-grid")).toBeVisible({ timeout: 15_000 });
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
