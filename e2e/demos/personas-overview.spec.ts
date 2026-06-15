import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo } from "../helpers/demo-video";

// # coverage: full-page tour of the personas library — scroll the loaded grid
// top->bottom, surface a card's per-row affordances (Edit/View/Duplicate/Delete),
// then drive every list control on camera: the THREE faceted pickers
// (Scenario / Field / Department) opened one-by-one (open -> reveal options ->
// pick first -> Escape -> Reset) plus search (type -> settle -> clear), the card
// View (column-visibility) toggle, pagination, and page size (the latter four via
// exerciseListView with skipFilters, since the pickers are driven explicitly
// above). Every beat past the page-ready / populated-grid gate (handled inside
// overviewDemo -> library.openIfPopulated + browse) is self-guarding: a control
// or card the page lacks is skipped via isVisible()/count() bails, never failed.
// All NON-DESTRUCTIVE — links are only hovered (never clicked, so we stay on the
// list), filters open-then-Reset, and Duplicate/Delete are never invoked.

// The three persona faceted-filter titles (DataTableFacetedFilter triggers inside
// ThreePickerFilters). The generic exerciseFilters only drives one; we open each
// in turn so all three read on camera.
const FILTER_TITLES = ["Scenario", "Field", "Department"] as const;

async function isVisible(locator: import("@playwright/test").Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

/** Open one faceted picker, reveal its options, pick the first (re-queries the
 *  grid), Escape to dismiss, then Reset to clear so the grid returns to full.
 *  Fully guarded: a picker/option the page lacks is skipped cleanly. */
async function exercisePicker(
  page: import("@playwright/test").Page,
  title: string,
  beat: number,
): Promise<void> {
  const trigger = page.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
  if (!(await isVisible(trigger))) return;

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(beat);

  // Options are CommandItems (role "option"). If none, just dismiss.
  const option = page.getByRole("option").first();
  if (!(await isVisible(option))) {
    await page.keyboard.press("Escape").catch(() => undefined);
    return;
  }
  await option.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(beat);
  await page.keyboard.press("Escape").catch(() => undefined);
  await waitOutSkeleton(page);
  await pauseForDemo(beat);

  // Reset clears the applied filter (table.resetColumnFilters + URL reset),
  // returning the grid to its full multi-page state. Shown only while filtered.
  const reset = page.getByRole("button", { name: /reset/i }).first();
  if (await isVisible(reset)) {
    await reset.scrollIntoViewIfNeeded().catch(() => undefined);
    await reset.click({ timeout: 10_000 }).catch(() => undefined);
    await waitOutSkeleton(page);
    await pauseForDemo(beat);
  }
}

test.describe("demo: personas overview", () => {
  test("browse the personas library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "persona", async (p) => {
      // The loaded, populated grid is already on screen + skeleton-settled
      // (overviewDemo -> library.openIfPopulated + browse). Trim any residual
      // shimmer before the first beat so no half-loaded frame is recorded.
      await waitOutSkeleton(p);

      // 1) Tour the grid top->bottom: bring the grid container into frame, then
      // walk the first few cards so the camera reads the library's contents.
      const grid = p.getByTestId("personas-grid").first();
      if (await isVisible(grid)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
      }

      const cards = p.getByTestId("persona-card");
      const cardCount = await cards.count().catch(() => 0);
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible().catch(() => false))) continue;
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(800);
      }

      // 2) Surface the per-card affordances on the first card so the row's
      // Edit / View / Duplicate / Delete controls read on camera — hover only,
      // never click (Edit/View navigate off the list; Duplicate/Delete mutate).
      await hoverLocatorIfVisible(p.getByTestId("btn-edit-persona"));
      await hoverLocatorIfVisible(p.getByTestId("btn-view-persona"));
      await hoverLocatorIfVisible(p.getByTestId("btn-duplicate-persona"));
      await hoverLocatorIfVisible(p.getByTestId("btn-delete-persona"));

      // 3) Drive each of the THREE faceted pickers in turn (Scenario / Field /
      // Department) so every filter reveals its options on camera, picks one
      // (visibly re-querying the grid), dismisses, then Resets. Each is
      // independently guarded — a picker or option the page lacks is skipped.
      for (const title of FILTER_TITLES) {
        await exercisePicker(p, title, 900);
      }

      // 4) Drive the remaining list controls on camera: search (type -> settle
      // -> clear), the card View (column-visibility) toggle, pagination
      // (Next -> Prev), and the page-size selector. skipFilters because the
      // three pickers are exercised explicitly above. Each step is guarded.
      await exerciseListView(p, { skipFilters: true });
    });
  });
});
