import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-bulk";

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

// coverage: tour the WHOLE documents management table top->bottom — scroll the
// populated rows, type into the name filter and clear it, open each column
// picker (Scenarios / Fields / Department) and the View-columns menu then
// dismiss, walk pagination next/prev, then bulk-select two rows to surface the
// selection toolbar, open-and-CANCEL the bulk-delete confirm, and clear the
// selection so the clip ends on the clean populated table. Every beat past the
// single page-ready assertion is guarded so a thin/empty list just skips it.
// HARD RULE: non-destructive — we open the delete confirm then back out; we
// never click the confirm button.

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

/** Tick a row's selection checkbox if present. Guarded so a short list skips. */
async function selectRow(page: Page, index: number): Promise<boolean> {
  const checkbox = page
    .getByRole("checkbox", { name: /^Select document /i })
    .nth(index);
  if (!(await checkbox.isVisible().catch(() => false))) return false;
  await checkbox.scrollIntoViewIfNeeded().catch(() => undefined);
  await checkbox.click().catch(() => undefined);
  await pauseForDemo(1_100);
  return true;
}

test.describe("demo: documents bulk", () => {
  test("tour the documents table, filters, and bulk-select", async ({ page }) => {
    test.setTimeout(120_000);

    // Open on the clean, unselected documents table.
    await page.goto("/management/documents");
    await expectAuthenticated(page);

    // ONE real page-ready assertion: the table surface is the feature
    // container. Generous wait — the SSR list loads all matching rows.
    await expect(page.getByTestId("documents-table")).toBeVisible({ timeout: 30_000 });

    // Trim the skeleton lead-in and hold on the populated list.
    await settleLoaded(page);

    // BEAT 1: scroll the populated rows top->bottom so the whole table reads.
    const rows = page.getByTestId("documents-row");
    const rowCount = await rows.count().catch(() => 0);
    if (rowCount > 0) {
      await rows.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await rows.nth(Math.min(rowCount - 1, 5)).scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await rows.last().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await rows.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 2: type into the name filter so the typing + client re-query shows,
    // let it react, then clear it back to the full list (read-only filter).
    const search = page.getByTestId("documents-search");
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 3: open each column picker, reveal options, dismiss — non-committal.
    await peekPicker(page, /^Scenarios$/);
    await peekPicker(page, /^Fields$/);
    await peekPicker(page, /^Department$/);

    // BEAT 4: open the View (toggle columns) dropdown, hold, dismiss.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await clickIfVisible(viewBtn, 1_300)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 5: walk pagination — next page, hold on the second page, back.
    const nextPage = page.getByRole("button", { name: /Go to next page/i }).first();
    if (await nextPage.isEnabled().catch(() => false)) {
      await clickIfVisible(nextPage, 1_300);
      const prevPage = page.getByRole("button", { name: /Go to previous page/i }).first();
      await clickIfVisible(prevPage, 1_200);
    }

    // BEAT 6 + 7: tick two rows so the selection toolbar swaps in. Each guarded
    // so a list with fewer rows simply skips the missing tick.
    const firstSelected = await selectRow(page, 0);
    const secondSelected = await selectRow(page, 1);

    // BEAT 8: reveal the destructive bulk action. The selection toolbar shows a
    // "Delete N of M" (or "Delete N matching") button once rows are held.
    const bulkDelete = page
      .getByTestId("documents-toolbar")
      .getByRole("button", { name: /^Delete \d+/ })
      .first();
    const haveBulkAction =
      firstSelected &&
      secondSelected &&
      (await bulkDelete.isVisible().catch(() => false));

    if (haveBulkAction && (await bulkDelete.isEnabled().catch(() => false))) {
      await bulkDelete.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_200);

      // BEAT 9: OPEN the bulk-delete confirm to show the affordance — then back
      // out. NON-DESTRUCTIVE: we never click the confirm button.
      await bulkDelete.click().catch(() => undefined);
      const confirm = page.getByTestId("btn-confirm-bulk-delete");
      if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await pauseForDemo(1_400);
        const cancel = page.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }
        await pauseForDemo(1_100);
      }

      // BEAT 10: clear the selection so the clip ends on a clean, populated
      // table — never a half-selected or empty-filter state.
      const unselect = page.getByRole("button", { name: /^Unselect All$/ }).first();
      await clickIfVisible(unselect, 900);
    }

    // End on the substantive, populated table.
    await expect(page.getByTestId("documents-table")).toBeVisible({ timeout: 15_000 });
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
