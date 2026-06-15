import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-bulk";

// # coverage: BULK-WORKFLOW tour of the simulations library, centered on
// multi-select. Open the LOADED, populated simulations grid (page-ready gate =
// simulations-grid + skeleton-settled), then build a visible multi-select by
// clicking 2-3 simulation cards (each card's onClick toggles selection — the
// card gains a primary ring + checkbox, and the filter toolbar swaps into the
// selection action bar). Hold on the selection toolbar so the live "Delete N of
// M" / "Edit N of M" bulk buttons read on camera, then OPEN the bulk-delete
// confirm dialog and CANCEL it (never confirm — fully NON-DESTRUCTIVE), and
// finally click "Unselect All" to return to the filter bar. Every beat past the
// single page-ready assertion is self-guarding (count()/isVisible().catch) so a
// control or card the page lacks is skipped, never failed. After the load gate
// we settle the skeleton so no half-loaded frame is recorded.

test.describe("demo: simulations bulk", () => {
  test("select multiple simulations and open the bulk-delete confirm (cancelled, non-destructive)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Open the simulations library on the LOADED, populated grid.
    await page.goto("/training/simulations");
    await expectAuthenticated(page);

    // The single real page-ready assertion: the grid container. Scoped to the
    // visible instance to ignore any transient stale-tree duplicate.
    await expect(
      page.getByTestId("simulations-grid").filter({ visible: true }),
    ).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Beat 1 — tour the grid top->bottom so the library's contents (names,
    // scenario/cohort badges, per-card Edit/View/Duplicate/Delete row) read on
    // camera before any selection. Guarded: with no cards the tour no-ops.
    const cards = page.getByTestId("simulation-card");
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // Beat 2 — build a visible multi-select. Clicking a card body toggles its
    // selection (card gains a primary ring + checkmark; the toolbar swaps into
    // the selection action bar reflecting the count). Guarded: if no cards
    // loaded, the whole selection sequence simply no-ops.
    if (cardCount > 0) {
      const first = cards.nth(0);
      if (await first.isVisible().catch(() => false)) {
        await first.scrollIntoViewIfNeeded().catch(() => undefined);
        await first.click().catch(() => undefined);
        await pauseForDemo(1_100);
      }

      // Second card so the selection is visibly plural ("2" in the bulk labels).
      if (cardCount > 1) {
        const second = cards.nth(1);
        if (await second.isVisible().catch(() => false)) {
          await second.scrollIntoViewIfNeeded().catch(() => undefined);
          await second.click().catch(() => undefined);
          await pauseForDemo(1_100);
        }
      }

      // Third card if present, building a clear multi-select.
      if (cardCount > 2) {
        const third = cards.nth(2);
        if (await third.isVisible().catch(() => false)) {
          await third.scrollIntoViewIfNeeded().catch(() => undefined);
          await third.click().catch(() => undefined);
          await pauseForDemo(1_100);
        }
      }
    }

    // Beat 3 — hold on the selection action bar so the viewer reads the live
    // selection state: the destructive "Delete N of M" and outline "Edit N of M"
    // bulk buttons with their counts, plus "Unselect All".
    const toolbar = page.getByTestId("simulations-toolbar").filter({ visible: true });
    if (await toolbar.first().isVisible().catch(() => false)) {
      await toolbar.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    // Beat 4 — surface the bulk Edit button (label "Edit N of M" or
    // "Edit N matching") so the non-destructive bulk action reads, hover only —
    // we will demonstrate the confirm/cancel flow through Delete instead.
    const bulkEditBtn = page
      .getByRole("button", { name: /^Edit \d+ (of \d+|matching)$/ })
      .first();
    if (await bulkEditBtn.isVisible().catch(() => false)) {
      await bulkEditBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await bulkEditBtn.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // Beat 5 — OPEN the bulk-DELETE confirm dialog, hold so its "cannot be
    // undone" copy + count read, then CANCEL. SAFETY: the destructive action is
    // shown but NEVER committed (no click on the confirm button). Guarded — a
    // missing button leaves the clip on the populated, selected grid.
    const bulkDeleteBtn = page
      .getByRole("button", { name: /^Delete \d+ (of \d+|matching)$/ })
      .first();
    if (await bulkDeleteBtn.isVisible().catch(() => false)) {
      await bulkDeleteBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await bulkDeleteBtn.click().catch(() => undefined);

      const dialog = page.getByTestId("dialog-bulk-delete-simulation").first();
      if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await pauseForDemo(1_600);

        // CANCEL out — never confirm. Prefer the explicit Cancel control; fall
        // back to Escape so the dialog always dismisses without deleting.
        const cancel = dialog.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        await pauseForDemo(1_100);
      }
    }

    // Beat 6 — clear the multi-select via "Unselect All", returning the toolbar
    // to its filter-bar state. Guarded: skipped cleanly if the button is gone.
    const unselectAll = page.getByRole("button", { name: /^Unselect All$/ }).first();
    if (await unselectAll.isVisible().catch(() => false)) {
      await unselectAll.scrollIntoViewIfNeeded().catch(() => undefined);
      await unselectAll.click().catch(() => undefined);
      // Settle any re-render of the grid before the closing frame.
      await waitOutSkeleton(page);
      await pauseForDemo(1_100);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
