import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo } from "../helpers/demo-video";

// # coverage: full-page tour of the departments library (/platform/departments).
// PAGE-READY GATE: overviewDemo -> facade.library.openIfPopulated() navigates,
// waits the toolbar + grid visible and (when populated) waits the loading
// skeleton out — so the first recorded frame is the LOADED grid, never a
// shimmer; the demo skips cleanly when the library is empty (no seed data to
// browse). Every beat past that gate self-guards (visible()/count() bail) so a
// control or card the page lacks is skipped, never failed. Beats:
//   (1) tour the loaded `departments-grid` top->bottom and walk the first few
//       `department-card`s so the camera reads the library's contents;
//   (2) surface a card's per-row affordances (Edit/View/Duplicate — hover only,
//       never click, so we stay on the list and never mutate);
//   (3) exerciseListView drives the shared list controls: types a selective term
//       into `departments-search` char-by-char (query + narrowing grid both read
//       on camera) then clears, opens the card View (column-visibility) menu
//       (toggle off -> on -> close), pages through pagination (Next -> Prev) and
//       resizes via the page-size selector;
//   (4) an EXPLICIT department-filter beat opens each faceted picker
//       (Profile/Settings/Logins) — these titles aren't in exerciseListView's
//       generic filter regex — revealing its options, then Escape (no commit).
// All non-destructive — search/filters open-then-dismiss, links are only
// hovered, Duplicate/Delete are never invoked. overviewDemo saves once under the
// canonical "departments-overview" name (the save closes the page, so the grid
// tour + every interaction happen first, inside the afterBrowse hook).

test.describe("demo: departments overview", () => {
  test("browse the departments library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "department", async (p) => {
      // The loaded, populated grid is already on screen + skeleton-settled
      // (overviewDemo -> library.openIfPopulated + browse). Trim any residual
      // shimmer before the first beat so no half-loaded frame is recorded.
      await waitOutSkeleton(p);

      // 1) Tour the grid top->bottom: bring the grid container into frame, then
      // walk the first few cards so the camera reads the library's contents.
      const grid = p.getByTestId("departments-grid").first();
      if (await grid.isVisible().catch(() => false)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
      }

      const cards = p.getByTestId("department-card");
      const cardCount = await cards.count().catch(() => 0);
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible().catch(() => false))) continue;
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(800);
      }

      // 2) Surface the per-card affordances on the first card so the row's
      // Edit / View / Duplicate controls read on camera — hover only, never
      // click (clicking Edit/View would navigate off the list page, and
      // Duplicate/Delete mutate).
      await hoverLocatorIfVisible(p.getByTestId("btn-edit-department"));
      await hoverLocatorIfVisible(p.getByTestId("btn-view-department"));
      await hoverLocatorIfVisible(p.getByTestId("btn-duplicate-department"));

      // 3) Drive the shared interactive list controls on camera. Each step
      // inside is independently guarded (visible()/count() bail) so a missing
      // control is skipped cleanly: search (type a selective term -> settle ->
      // clear), the card View (column-visibility) toggle, pagination
      // (Next -> Prev), and the page-size selector. We skip the generic
      // faceted-filter step here because the departments toolbar's pickers are
      // titled Profile/Settings/Logins — names the shared step's regex doesn't
      // match — and exercise them explicitly in beat (4) instead. All read-only
      // / reversible.
      await exerciseListView(p, { skipFilters: true });

      // 4) The departments-specific faceted filters: open each picker
      // (Profile / Settings / Logins — a DataTableFacetedFilter whose trigger's
      // accessible name is its title), reveal its option list, then dismiss with
      // Escape WITHOUT selecting anything (no URL commit, no re-query side
      // effect). Each filter is independently guarded so an absent or
      // empty-option picker is skipped cleanly.
      for (const title of ["Profile", "Settings", "Logins"]) {
        const trigger = p.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
        if (!(await trigger.isVisible().catch(() => false))) continue;
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click({ timeout: 10_000 }).catch(() => undefined);
        await pauseForDemo(900);
        // Hold on the revealed options so they read on camera (guarded — a
        // single-/empty-option picker just has nothing to settle on).
        const option = p.getByRole("option").first();
        if (await option.isVisible().catch(() => false)) {
          await pauseForDemo(700);
        }
        // Dismiss without committing — never mutate the applied filter set.
        await p.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }

      // Land the clip back on the populated grid (a settled, full-list frame
      // rather than mid-interaction) so the recording ends substantive.
      await waitOutSkeleton(p);
      if (await grid.isVisible().catch(() => false)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(800);
      }
    });
  });
});
