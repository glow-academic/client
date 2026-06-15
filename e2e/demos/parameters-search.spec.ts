import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: search-led full-page tour of the parameters library
// (/management/parameters). PAGE-READY GATE: facade.library.openIfPopulated()
// navigates, waits the toolbar + grid visible, and (when populated) waits the
// loading skeleton out — so the first recorded frame is the LOADED grid, never a
// shimmer. The demo skips cleanly when the library is empty (no seed data to
// search). Past that gate every beat self-guards (visible()/count() bail) so a
// control or card the page lacks is skipped, never failed. Beats:
//   (1) tour the loaded `parameters-grid` top->bottom and walk a few
//       `parameter-card`s, surfacing each card's per-row affordances
//       (Edit/View/Duplicate — hover only, never click, so we stay on the list);
//   (2) the SEARCH headline: exerciseListView types a selective term into the
//       page's `parameters-search` box character-by-character (so the query + the
//       narrowing grid both read on camera), settles, then clears back;
//   (3) it then opens the ThreePickerFilters facets (Scenario/Field/Department)
//       and the card View (column-visibility) menu, reveals options, then
//       Reset/closes;
//   (4) it pages through pagination (Next -> Prev) and the page-size selector.
// All non-destructive — search/filters open-then-reset, links are only hovered,
// Duplicate/Delete are never invoked. We save once under the search slot's
// canonical "parameters-search" name (saveDemoVideo closes the page, so it is the
// final beat).

test.describe("demo: parameters search", () => {
  test("search the parameters library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["parameter"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // PAGE-READY GATE: open the list and confirm it's populated (toolbar + grid
    // visible, skeleton settled). Skip — don't fail — when the library is empty,
    // since a search demo needs data to narrow.
    test.skip(
      !(await facade.library.openIfPopulated()),
      `${spec.plural} library is empty (no seed data to search)`,
    );

    // Trim any residual shimmer before the first beat so no half-loaded frame is
    // recorded.
    await waitOutSkeleton(page);

    // 1) Tour the grid top->bottom: bring the grid container into frame, then
    // walk the first few cards so the camera reads the library's contents.
    const grid = page.getByTestId("parameters-grid").first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const cards = page.getByTestId("parameter-card");
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // 2) Surface the per-card affordances on the first card so the row's
    // Edit / View / Duplicate controls read on camera — hover only, never click
    // (clicking Edit/View would navigate off the list; Duplicate mutates).
    await hoverLocatorIfVisible(page.getByTestId("btn-edit-parameter"));
    await hoverLocatorIfVisible(page.getByTestId("btn-view-parameter"));
    await hoverLocatorIfVisible(page.getByTestId("btn-duplicate-parameter"));

    // 3+4) The headline of the SEARCH slot: drive every interactive list control
    // on camera. exerciseListView's search step targets the page's
    // `parameters-search` box by testid (sidebar-proof), derives a selective term
    // from a visible card so the grid visibly narrows, types it character-by-
    // character (delay ~40ms so the query appears), settles on the filtered grid,
    // then clears back. It then opens the Scenario/Field/Department faceted
    // filters (open -> pick -> Reset), the card View (column-visibility) toggle,
    // pagination (Next -> Prev), and the page-size selector. Each step is
    // independently guarded so a control the page lacks is skipped cleanly. All
    // read-only / reversible.
    await exerciseListView(page);

    // Land the clip back on the populated grid (a settled, full-list frame rather
    // than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    await scrollToText(page, /parameters grid|parameters/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "parameters-search");
  });
});
