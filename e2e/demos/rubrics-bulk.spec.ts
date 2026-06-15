// # coverage: BULK-WORKFLOW tour of /platform/rubrics — the multi-select path,
// distinct from rubrics-overview (which only briefly grazed selection). Opens
// the populated card grid (page-ready `rubrics-grid`), settles past the
// skeleton, hovers + scrolls the metric rows so the library reads, then drives
// the SELECTION workflow on camera: click 2-3 rubric cards so the toolbar swaps
// from the filter bar to the SELECTION ACTION BAR (`rubrics-toolbar` now showing
// "Delete N of M" + "Edit N of M" + "Select Page" + "Unselect All"), scroll the
// bulk Delete/Edit affordances into frame, OPEN the bulk-delete confirm dialog
// (`dialog-bulk-delete-rubric`) so its "This action cannot be undone" copy
// reads, then CANCEL it (never the destructive confirm), and finally click
// "Unselect All" to return the toolbar to its clean default filter bar. Every
// beat past the one page-ready assertion is guarded (isVisible().catch + count
// bails) and NON-DESTRUCTIVE: card selection is reversible URL-backed view
// state, the delete dialog is open-then-Cancel, and nothing is committed (no
// rubric deleted, edited, duplicated, or created).
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-bulk";

test.describe("demo: rubrics bulk", () => {
  test("tours the rubric library multi-select workflow: select cards, reveal the bulk toolbar, open + cancel bulk delete, unselect all", async ({
    page,
  }) => {
    await page.goto("/platform/rubrics");
    await expectAuthenticated(page);
    // The loaded list renders `rubrics-grid` (the card container); the loading
    // state renders skeletons (detached once data lands). This is the single
    // real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("rubrics-grid")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in and hold a beat on the populated library so
    // no skeleton frame is recorded before the workflow begins.
    await settleLoaded(page);

    // BEAT 1 — establish the populated library: hover the first card so the
    // cursor visibly tracks across it, then scroll a card's points / pass
    // summary into frame so the metric row reads before we start selecting.
    await hoverFirstVisible(page, "rubric-card");
    const cards = page.getByTestId("rubric-card");
    await scrollToText(page, /total points|pass:/i);
    await pauseForDemo(1_000);

    // BEAT 2 — the heart of this demo: SELECT multiple rubric cards so the
    // toolbar swaps from the filter bar to the selection action bar. Clicking a
    // card body toggles its (URL-backed, reversible) selection — we click 2-3
    // cards' header areas (the title text, away from the per-card action
    // buttons) so the cursor visibly checks each one. Guarded so a card-less
    // library is a clean no-op.
    const cardCount = await cards.count().catch(() => 0);
    const toSelect = Math.min(cardCount, 3);
    for (let i = 0; i < toSelect; i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      // Click the card's title text — inside the card body, outside the
      // `data-action-button` zones (Edit/Duplicate/Delete/checkbox), so the
      // click resolves to handleCardClick → toggleSelection rather than an
      // Edit-link navigation or a per-row delete.
      const title = card.getByRole("heading").first();
      if (await title.isVisible().catch(() => false)) {
        await title.click().catch(() => undefined);
      } else {
        await card.click({ position: { x: 12, y: 12 } }).catch(() => undefined);
      }
      await pauseForDemo(900);
    }

    // BEAT 3 — let the SELECTION ACTION BAR read on frame. Once selectedCount > 0
    // the `rubrics-toolbar` re-renders to show the bulk affordances: a
    // destructive "Delete N of M", an "Edit N of M", "Select Page", and
    // "Unselect All". Scroll the count + bulk actions into view so the swap is
    // legible. Guarded — if selection never took, this no-ops cleanly.
    await scrollToText(page, /delete \d+|edit \d+|unselect all/i);
    await pauseForDemo(1_300);

    // BEAT 4 — OPEN the bulk-delete confirm dialog so its content reads, then
    // CANCEL it. This reveals the destructive affordance + its "This action
    // cannot be undone" guard copy WITHOUT committing — we click Cancel, never
    // the `btn-confirm-bulk-delete` action. Guarded so an absent toolbar/dialog
    // no-ops. The dialog only opens when at least one selected row is deletable
    // (the Delete button disables otherwise), so this beat self-skips on a
    // library of in-use, non-deletable rubrics.
    const bulkDelete = page
      .getByRole("button", { name: /^Delete \d+ (of \d+|matching)$/ })
      .first();
    if (
      (await bulkDelete.isVisible().catch(() => false)) &&
      (await bulkDelete.isEnabled().catch(() => false))
    ) {
      await bulkDelete.scrollIntoViewIfNeeded().catch(() => undefined);
      await bulkDelete.click().catch(() => undefined);
      // Let the confirm dialog mount + its warning copy read.
      const dialog = page.getByTestId("dialog-bulk-delete-rubric").first();
      if (await dialog.isVisible().catch(() => false)) {
        await pauseForDemo(1_500);
        await scrollToText(page, /cannot be undone|will be deleted/i);
        await pauseForDemo(900);
        // NON-DESTRUCTIVE EXIT: click Cancel (never the destructive confirm).
        const cancel = page.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        // Wait for the dialog to detach so the next beat reads the grid, not a
        // half-dismissed overlay.
        await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
        await pauseForDemo(1_000);
      }
    }

    // BEAT 5 — also reveal the bulk EDIT affordance (open + Escape) so both
    // multi-row actions register. Opening the edit dialog stages nothing until
    // Save, so an open-then-Escape is non-destructive. Guarded.
    const bulkEdit = page
      .getByRole("button", { name: /^Edit \d+ (of \d+|matching)$/ })
      .first();
    if (
      (await bulkEdit.isVisible().catch(() => false)) &&
      (await bulkEdit.isEnabled().catch(() => false))
    ) {
      await bulkEdit.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 6 — close the loop: click "Unselect All" so the selection clears and
    // the toolbar swaps back to its default filter bar — leaving nothing staged.
    // Guarded; fallback re-clicks the cards to toggle the selection back off.
    const unselect = page.getByRole("button", { name: /unselect all/i }).first();
    if (await unselect.isVisible().catch(() => false)) {
      await unselect.click().catch(() => undefined);
      await pauseForDemo(1_200);
    } else {
      for (let i = 0; i < toSelect; i++) {
        const card = cards.nth(i);
        const title = card.getByRole("heading").first();
        if (await title.isVisible().catch(() => false)) {
          await title.click().catch(() => undefined);
          await pauseForDemo(500);
        }
      }
    }

    // End held on the clean, populated rubric grid — substantive content on
    // frame, no selection staged, nothing mutated.
    await scrollToText(page, /total points|pass:/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
