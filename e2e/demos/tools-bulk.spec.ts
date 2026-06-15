import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: a BULK-WORKFLOW tour of the Tools library (/intelligence/tools)
// centered on multi-select. Land on the populated tools-grid, settle the
// skeleton out, then select 2-3 tool cards by their per-card selection
// checkbox — which surfaces the selection toolbar with its live "Delete N of
// M" / "Edit N of M" counts. Reveal the bulk Edit dialog and Escape it, OPEN
// the bulk-delete confirm dialog then CANCEL it, and finally Unselect All to
// collapse the toolbar back to the filter bar. Every beat past the one
// page-ready assertion is GUARDED (isVisible().catch(()=>false) / enabled
// checks) so a control the page lacks is skipped, not failed. Strictly
// NON-DESTRUCTIVE: selecting + open-then-Cancel/Escape only — we NEVER confirm
// a delete or apply a bulk edit, so the live library is left untouched.

const TOPIC = "tools-bulk";

/** True when the first match of a locator is visible. Never throws. */
async function shown(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

/** Select up to `want` tool cards by clicking each card's selection checkbox.
 *  The checkbox lives in a `[data-action-button]` wrapper that the card's own
 *  click handler ignores, so this selects the row rather than navigating away.
 *  The checkbox is hover-revealed until a selection exists, so hover the card
 *  first. Returns how many were actually toggled on. Guarded throughout. */
async function selectCards(page: Page, want: number): Promise<number> {
  const cards = page.getByTestId("tool-card");
  const available = await cards.count().catch(() => 0);
  let selected = 0;
  for (let i = 0; i < available && selected < want; i++) {
    const card = cards.nth(i);
    if (!(await card.isVisible().catch(() => false))) continue;
    await card.scrollIntoViewIfNeeded().catch(() => undefined);
    await card.hover().catch(() => undefined);
    const checkbox = card.getByRole("checkbox", { name: /^Select tool / }).first();
    if (!(await checkbox.isVisible().catch(() => false))) continue;
    await checkbox.click({ timeout: 10_000 }).catch(() => undefined);
    await pauseForDemo(650);
    selected++;
  }
  return selected;
}

test.describe("demo: tools bulk", () => {
  test("multi-select bulk workflow on the tools library", async ({ page }) => {
    test.setTimeout(120_000);

    // 1) Land on the Tools index, prove we're authed, and wait the loading
    //    skeleton out so the opening frames are the populated grid (the one
    //    page-ready assertion every later beat is allowed to depend on).
    await page.goto("/intelligence/tools");
    await expectAuthenticated(page);
    await expect(page.getByTestId("tools-grid")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // 2) Tour the grid: hover the first card so its selection checkbox reveals,
    //    then hold on the populated library before we start selecting.
    await hoverFirstVisible(page, "tool-card");
    await pauseForDemo(700);

    // 3) MULTI-SELECT — tick the selection checkbox on 2-3 cards. Each tick
    //    surfaces the selection toolbar and bumps its live "N selected"-style
    //    counts. Guarded to a no-op if the library is empty.
    const picked = await selectCards(page, 3);

    // 4) SELECTION TOOLBAR — once anything is selected the filter bar swaps to
    //    the action bar. Hold on it so the live "Delete N of M" / "Edit N of M"
    //    counts read on camera. (All later beats no-op if nothing got picked.)
    if (picked > 0) {
      const toolbar = page.getByTestId("tools-toolbar");
      if (await shown(toolbar)) {
        await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(1_100);
      }

      // 5) BULK EDIT — open the bulk-edit dialog so its field(s) read, hold,
      //    then Escape WITHOUT applying. The trigger is disabled when nothing
      //    editable is selected, so it's guarded on enabled state.
      const editBtn = page
        .getByRole("button", { name: /^Edit \d+ (of \d+|matching)$/ })
        .first();
      if ((await shown(editBtn)) && (await editBtn.isEnabled().catch(() => false))) {
        await editBtn.click({ timeout: 10_000 }).catch(() => undefined);
        const editDialog = page.getByTestId("dialog-bulk-edit");
        if (await shown(editDialog)) {
          await pauseForDemo(1_200);
          await page.keyboard.press("Escape").catch(() => undefined);
          await pauseForDemo(600);
        }
      }

      // 6) BULK DELETE CONFIRM — open the destructive confirm dialog so its
      //    "this cannot be undone" copy + count reads, hold, then CANCEL.
      //    NON-DESTRUCTIVE: we click Cancel, never the confirm button. The
      //    trigger is disabled when nothing deletable is selected, so guard it.
      const deleteBtn = page
        .getByRole("button", { name: /^Delete \d+ (of \d+|matching)$/ })
        .first();
      if ((await shown(deleteBtn)) && (await deleteBtn.isEnabled().catch(() => false))) {
        await deleteBtn.click({ timeout: 10_000 }).catch(() => undefined);
        const confirm = page.getByTestId("dialog-bulk-delete-tool");
        if (await shown(confirm)) {
          await pauseForDemo(1_300);
          const cancel = confirm.getByRole("button", { name: /^Cancel$/ }).first();
          if (await shown(cancel)) {
            await cancel.click({ timeout: 10_000 }).catch(() => undefined);
          } else {
            await page.keyboard.press("Escape").catch(() => undefined);
          }
          await pauseForDemo(700);
        }
      }

      // 7) UNSELECT ALL — collapse the selection back, returning the toolbar to
      //    its filter-bar state. Closes the loop on the bulk workflow.
      const unselect = page.getByRole("button", { name: /^Unselect All$/ }).first();
      if (await shown(unselect)) {
        await unselect.scrollIntoViewIfNeeded().catch(() => undefined);
        await unselect.click({ timeout: 10_000 }).catch(() => undefined);
        await settleLoaded(page);
      }
    }

    await saveDemoVideo(page, TOPIC);
  });
});
