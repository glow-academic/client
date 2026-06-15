import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-bulk";

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

// coverage: tour the WHOLE models management surface top->bottom — scroll the
// populated card grid, type into the name search and clear it, open each
// faceted picker (Provider / Agent / Department), peek the View-columns menu and
// the Rows-per-page picker then dismiss with Escape, walk pagination next/prev,
// then bulk-select two cards to swap in the selection toolbar, OPEN-and-CANCEL
// the bulk-delete confirm, and Unselect All so the clip ends on the clean,
// populated grid. Every beat past the single page-ready assertion is guarded so
// a thin/empty library just skips it. HARD RULE: non-destructive — we open the
// delete confirm then back out; we never click the confirm button
// (btn-confirm-bulk-delete / btn-confirm-delete) and we reset every read-only
// filter we touch.

/** Click a locator if it is visible, hold a demo beat. No-op when absent. */
async function clickIfVisible(target: Locator, hold = 1_100): Promise<boolean> {
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click().catch(() => undefined);
  await pauseForDemo(hold);
  return true;
}

/** Open a ThreePickerFilters popover by its trigger label, reveal its options,
 *  then dismiss with Escape — never commits a filter. */
async function peekPicker(page: Page, label: RegExp): Promise<void> {
  const trigger = page.getByRole("button", { name: label }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  await pauseForDemo(1_200);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
}

/** Tick a card's selection checkbox by zero-based index. Guarded so a short
 *  library skips the missing tick. */
async function selectCard(page: Page, index: number): Promise<boolean> {
  const checkbox = page
    .getByRole("checkbox", { name: /^Select model /i })
    .nth(index);
  if (!(await checkbox.isVisible().catch(() => false))) return false;
  await checkbox.scrollIntoViewIfNeeded().catch(() => undefined);
  await checkbox.click().catch(() => undefined);
  await pauseForDemo(1_100);
  return true;
}

test.describe("demo: models bulk", () => {
  test("tour the models grid, filters, and bulk-select", async ({ page }) => {
    test.setTimeout(120_000);

    // Open on the clean, unselected models card grid.
    await page.goto("/intelligence/models");
    await expectAuthenticated(page);

    // ONE real page-ready assertion: the card grid is the feature container.
    await expect(page.getByTestId("models-grid")).toBeVisible({ timeout: 30_000 });

    // Trim the skeleton lead-in and hold on the populated grid.
    await settleLoaded(page);

    // BEAT 1: scroll the populated cards top->bottom so the whole grid reads.
    const cards = page.getByTestId("model-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 0) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await cards.nth(Math.min(cardCount - 1, 5)).scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await cards.last().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 2: type into the name search so the typing + client re-query shows,
    // let it react, then clear it back to the full grid (read-only filter).
    const search = page.getByTestId("models-search");
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 3: open each faceted picker, reveal options, dismiss — non-committal.
    await peekPicker(page, /^Provider$/);
    await peekPicker(page, /^Agent$/);
    await peekPicker(page, /^Department$/);

    // BEAT 4: open the View (toggle columns) dropdown, hold, dismiss.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await clickIfVisible(viewBtn, 1_300)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 5: peek the Rows/Items-per-page picker, reveal options, dismiss.
    const pageSizeBtn = page.getByRole("combobox").first();
    if (await clickIfVisible(pageSizeBtn, 1_200)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 6: walk pagination — next page, hold on the second page, back. Models
    // is a CARD GRID that often fits on one page, so the pagination button is
    // frequently ABSENT. Gate isEnabled() behind isVisible() (fast-fails for an
    // absent element) + a short explicit timeout so a never-attached locator
    // never waits out the full test timeout.
    const nextPage = page.getByRole("button", { name: /Go to next page/i }).first();
    if (
      (await nextPage.isVisible().catch(() => false)) &&
      (await nextPage.isEnabled({ timeout: 1_500 }).catch(() => false))
    ) {
      await clickIfVisible(nextPage, 1_300);
      const prevPage = page.getByRole("button", { name: /Go to previous page/i }).first();
      await clickIfVisible(prevPage, 1_200);
    }

    // BEAT 7 + 8: tick two cards so the selection toolbar swaps in. Each guarded
    // so a library with fewer cards simply skips the missing tick.
    const firstSelected = await selectCard(page, 0);
    const secondSelected = await selectCard(page, 1);

    // BEAT 9: reveal the destructive bulk action. The selection toolbar shows a
    // "Delete N of M" (or "Delete N matching") button once cards are held.
    const bulkDelete = page
      .getByTestId("models-toolbar")
      .getByRole("button", { name: /^Delete \d+/ })
      .first();
    const haveBulkAction =
      firstSelected &&
      secondSelected &&
      (await bulkDelete.isVisible().catch(() => false));

    if (haveBulkAction && (await bulkDelete.isEnabled().catch(() => false))) {
      await bulkDelete.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_200);

      // BEAT 10: OPEN the bulk-delete confirm to show the affordance — then back
      // out. NON-DESTRUCTIVE: we never click the confirm button.
      await bulkDelete.click().catch(() => undefined);
      const dialog = page.getByTestId("dialog-bulk-delete-model");
      if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await pauseForDemo(1_400);
        const cancel = dialog.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        await pauseForDemo(1_100);
      }

      // BEAT 11: clear the selection so the clip ends on a clean, populated
      // grid — never a half-selected or open-confirm state.
      const unselect = page.getByRole("button", { name: /^Unselect All$/ }).first();
      await clickIfVisible(unselect, 900);
    }

    // End on the substantive, populated grid.
    await expect(page.getByTestId("models-grid")).toBeVisible({ timeout: 15_000 });
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
