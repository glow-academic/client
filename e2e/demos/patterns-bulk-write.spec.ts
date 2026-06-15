import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-bulk-write";

type Locator = import("@playwright/test").Locator;

// coverage: BULK-WRITE workflow tour of the personas library (card grid). Orient
// on the toolbar, scroll the populated cards, then drive the multi-select bulk
// WRITE path top->bottom: click 2-3 persona cards to build a selection, watch
// the toolbar swap into the selection action bar ("Delete N of M" / "Edit N of
// M" / Unselect All), OPEN the bulk-EDIT (write) dialog to reveal the additive
// per-field bulk-update affordances (active status / color / icon / department
// / voice) and Escape, then OPEN the bulk-DELETE confirm to show the destructive
// affordance and CANCEL it, and finally Unselect All so the clip ends on a
// clean, populated grid.
//
// HARD RULES (LIVE instance): every beat is NON-DESTRUCTIVE (open-then-
// cancel/Escape; neither the bulk-edit Save nor the bulk-delete confirm is ever
// clicked) and GUARDED — past the single page-ready assertion, a missing/absent
// control makes the beat a no-op rather than failing the recording. The one hard
// assertion is the personas-grid ready-testid.

/** Click a locator if it is visible, then hold a demo beat. No-op when absent. */
async function clickIfVisible(target: Locator, hold = 1_100): Promise<boolean> {
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click().catch(() => undefined);
  await pauseForDemo(hold);
  return true;
}

test.describe("demo: patterns bulk write", () => {
  test("multi-select personas then reveal bulk edit (write) + bulk delete confirm (non-destructive)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Open on the personas library (clean, unselected).
    await page.goto("/training/personas");
    await expectAuthenticated(page);

    // ONE real page-ready assertion: the card grid is the feature container.
    await expect(page.getByTestId("personas-grid")).toBeVisible({ timeout: 40_000 });

    // Trim the skeleton lead-in so the clip never opens on the shimmer.
    await settleLoaded(page);

    // BEAT 1 — orient on the management toolbar (search + filters + actions).
    const toolbar = page.getByTestId("personas-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await toolbar.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 2 — scroll the populated cards so the whole grid reads top->bottom.
    const cards = page.getByTestId("persona-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 0) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      await cards.nth(Math.min(cardCount - 1, 4)).scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 3 — build a MULTI-card selection: click 2-3 cards in turn. Clicking a
    // card body toggles its selection (the inline checkbox appears + the card
    // gets a primary ring), and the FIRST selection flips the toolbar into the
    // bulk-action bar. Hold a beat after each so the growing "N selected" count
    // and the swelling selection visibly read. Guarded on an empty grid.
    const targetSelections = Math.min(cardCount, 3);
    let selectedAny = false;
    for (let i = 0; i < targetSelections; i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.click().catch(() => undefined);
      await pauseForDemo(1_100);
      selectedAny = true;
    }

    if (selectedAny) {
      // BEAT 4 — hold on the selection action bar so the bulk affordances read:
      // the destructive "Delete N of M", the "Edit N of M" write button, and the
      // Unselect All escape hatch all live in the swapped-in toolbar.
      const selectionBar = page.getByTestId("personas-toolbar").first();
      if (await selectionBar.isVisible().catch(() => false)) {
        await selectionBar.scrollIntoViewIfNeeded().catch(() => undefined);
        await selectionBar.hover().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // BEAT 5 — OPEN the bulk-EDIT (write) dialog. This is the heart of the
      // bulk-WRITE workflow: it reveals the additive per-field updates (Active
      // Status tri-state + Color / Icon / Department / Voice pickers) that apply
      // across every selected persona. Hold so the form reads, then Escape — no
      // Save is ever clicked, so nothing is written.
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
        await pauseForDemo(1_700);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 6 — OPEN the bulk-DELETE confirm to show the destructive affordance
      // (it lists exactly which selected personas will/won't be removed), hold on
      // it, then CANCEL. NON-DESTRUCTIVE: the confirm button is never clicked.
      const bulkDelete = page
        .getByTestId("personas-toolbar")
        .getByRole("button", { name: /^Delete \d+/ })
        .first();
      if (
        (await bulkDelete.isVisible().catch(() => false)) &&
        (await bulkDelete.isEnabled().catch(() => false))
      ) {
        await bulkDelete.click().catch(() => undefined);
        const deleteDialog = page.getByTestId("dialog-bulk-delete-persona").first();
        await deleteDialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
        await pauseForDemo(1_600);
        const cancel = page.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        await pauseForDemo(1_000);
      }

      // BEAT 7 — clear the selection so the clip ends on a clean, populated grid
      // — never a half-selected state.
      const unselect = page.getByRole("button", { name: /^Unselect All$/ }).first();
      await clickIfVisible(unselect, 900);
    }

    // End on the substantive, populated grid.
    await expect(page.getByTestId("personas-grid")).toBeVisible({ timeout: 15_000 });
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
