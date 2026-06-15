import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-bulk";

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

// coverage: BULK-WORKFLOW tour of the scenarios library (card grid) centered on
// multi-select — orient on the management toolbar, scroll the populated cards
// top->bottom, type into the name search (then clear), open EACH faceted filter
// popover (Persona / Simulation / Department) and Escape, open the "View"
// column-visibility menu and Escape, then exercise the BULK path: click 2-3
// scenario cards to flip the toolbar into selection mode (toolbar shows the
// 'N selected' bulk-action bar), reveal the bulk Delete + Edit buttons, OPEN the
// bulk-delete confirm dialog and CANCEL it (never confirmed), OPEN the bulk-edit
// dialog and Escape, then Unselect All so the clip ends on a clean, populated
// grid.
//
// HARD RULES (LIVE instance): every beat is NON-DESTRUCTIVE (open-then-
// cancel/Escape; the bulk-delete confirm is never clicked) and GUARDED — past
// the single page-ready assertion, a missing/absent control makes the beat a
// no-op rather than failing the recording. The one hard assertion is the
// scenarios-grid ready-testid.

/** Click a locator if it is visible, then hold a demo beat. No-op when absent. */
async function clickIfVisible(target: Locator, hold = 1_100): Promise<boolean> {
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click().catch(() => undefined);
  await pauseForDemo(hold);
  return true;
}

/** Open a ThreePickerFilters popover by its trigger label, reveal its options,
 *  then dismiss with Escape — never commits a filter. No-op when absent. */
async function peekFilter(page: Page, label: RegExp): Promise<void> {
  const trigger = page.getByRole("button", { name: label }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  await pauseForDemo(1_200);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
}

/** Select a scenario card by clicking its body (the card toggles selection;
 *  action-button regions are excluded by handleCardClick, so a plain body click
 *  flips the row's checkbox). No-op when the nth card is absent. */
async function selectCard(cards: Locator, index: number, hold = 1_100): Promise<boolean> {
  const card = cards.nth(index);
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.scrollIntoViewIfNeeded().catch(() => undefined);
  await card.hover().catch(() => undefined);
  await card.click({ position: { x: 8, y: 8 } }).catch(() => undefined);
  await pauseForDemo(hold);
  return true;
}

test.describe("demo: scenarios bulk", () => {
  test("tour the scenarios grid + filters, multi-select cards & reveal bulk delete/edit (non-destructive)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Open on the scenarios library (clean, unselected).
    await page.goto("/training/scenarios");
    await expectAuthenticated(page);

    // ONE real page-ready assertion: the card grid is the feature container.
    await expect(page.getByTestId("scenarios-grid")).toBeVisible({ timeout: 40_000 });

    // Trim the skeleton lead-in and hold on the populated grid so the clip
    // never opens on the washed-out fade-in shimmer.
    await settleLoaded(page);

    // BEAT 1 — orient on the management toolbar (search + filters + actions).
    const toolbar = page.getByTestId("scenarios-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await toolbar.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 2 — scroll the populated cards top->bottom so the whole grid reads.
    const cards = page.getByTestId("scenario-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 0) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
      await cards.nth(Math.min(cardCount - 1, 5)).scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      await cards.last().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 3 — type into the name search so the typing shows + the grid
    // re-queries live, let it react, then clear it back to the full list.
    const search = page.getByTestId("scenarios-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await search.press("Enter").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 4 — open EACH faceted filter popover, reveal its options, and Escape
    // WITHOUT committing a filter (read-only peek).
    await peekFilter(page, /^Persona$/);
    await peekFilter(page, /^Simulation$/);
    await peekFilter(page, /^Department$/);

    // BEAT 5 — open the "View" column-visibility menu to show the toggle-column
    // options, hold, then Escape (nothing toggled).
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await clickIfVisible(viewBtn, 1_300)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 6 — MULTI-SELECT: click 2-3 cards to flip the toolbar into selection
    // mode. Each card toggles its row checkbox, swapping the toolbar in for the
    // bulk-action bar ('N selected' → Delete / Edit / Unselect All). Guarded:
    // skips cleanly on an empty grid.
    let selectedCount = 0;
    if (await selectCard(cards, 0, 1_200)) selectedCount += 1;
    if (await selectCard(cards, 1, 1_100)) selectedCount += 1;
    if (await selectCard(cards, 2, 1_100)) selectedCount += 1;

    if (selectedCount > 0) {
      // Hold on the selection toolbar so the 'N selected' bulk-action bar reads.
      const selToolbar = page.getByTestId("scenarios-toolbar").first();
      if (await selToolbar.isVisible().catch(() => false)) {
        await selToolbar.scrollIntoViewIfNeeded().catch(() => undefined);
        await selToolbar.hover().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // BEAT 7 — OPEN the bulk-delete confirm to show the destructive affordance,
      // hold on it, then CANCEL. NON-DESTRUCTIVE: the confirm is never clicked.
      const bulkDelete = page
        .getByTestId("scenarios-toolbar")
        .getByRole("button", { name: /^Delete \d+/ })
        .first();
      if (
        (await bulkDelete.isVisible().catch(() => false)) &&
        (await bulkDelete.isEnabled().catch(() => false))
      ) {
        await bulkDelete.click().catch(() => undefined);
        const dialog = page.getByTestId("dialog-bulk-delete-scenario").first();
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

      // BEAT 8 — OPEN the bulk-edit dialog to show the additive bulk-update
      // affordance (active-status + departments), hold, then Escape — no save.
      const bulkEdit = page
        .getByTestId("scenarios-toolbar")
        .getByRole("button", { name: /^Edit \d+/ })
        .first();
      if (
        (await bulkEdit.isVisible().catch(() => false)) &&
        (await bulkEdit.isEnabled().catch(() => false))
      ) {
        await bulkEdit.click().catch(() => undefined);
        await pauseForDemo(1_500);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 9 — clear the selection so the clip ends on a clean, populated
      // grid — never a half-selected or filtered state.
      const unselect = page.getByRole("button", { name: /^Unselect All$/ }).first();
      await clickIfVisible(unselect, 900);
    }

    // End on the substantive, populated grid.
    await expect(page.getByTestId("scenarios-grid")).toBeVisible({ timeout: 15_000 });
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
