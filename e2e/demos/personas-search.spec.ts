import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: SEARCH-LED full-page tour of the personas library
// (/training/personas). Distinct from personas-overview (which is grid-tour-led):
// the CENTERPIECE here is the search box. PAGE-READY GATE:
// facade.library.openIfPopulated() navigates, waits the toolbar + grid visible,
// and (when populated) waits the loading skeleton out — so the first recorded
// frame is the LOADED grid, never a shimmer. The demo skips cleanly when the
// library is empty (a search demo needs data to narrow). Past that gate every
// beat self-guards (isVisible()/count() bail) so a control or card the page
// lacks is skipped, never failed. Beats:
//   (1) brief hold on the loaded grid so the camera reads the full library;
//   (2) the HEADLINE: derive a REAL, data-driven persona term from the first
//       card's name and type it into the `personas-search` box CHARACTER-BY-
//       CHARACTER (pressSequentially, delay ~55ms) so the query + the narrowing
//       grid both read on camera; hold on the filtered result, then clear back
//       to the full grid (each transition skeleton-settled);
//   (3) a brief read-only filter + pagination tour via exerciseListView with
//       skipSearch (the search is driven explicitly above): it opens the first
//       faceted picker (Scenario/Field/Department — open -> pick -> Escape ->
//       Reset), the card View (column-visibility) toggle, pagination
//       (Next -> Prev), and the page-size selector. Each step is guarded.
// All NON-DESTRUCTIVE — search types-then-clears, filters open-then-Reset,
// pagination/page-size are reversible, links are never clicked, and
// Duplicate/Delete are never invoked. We save once under the search slot's
// canonical "personas-search" name (saveDemoVideo closes the page, so it is the
// final beat).

async function isVisible(locator: import("@playwright/test").Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

test.describe("demo: personas search", () => {
  test("search the personas library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["persona"]!;
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

    // 1) Hold briefly on the loaded grid so the camera reads the full library
    // before the search narrows it.
    const grid = page.getByTestId("personas-grid").first();
    if (await isVisible(grid)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // 2) THE HEADLINE — search by a REAL, data-derived persona term.
    //
    // Read the first card's actual display name (Library.firstCardName reads its
    // aria-label "persona card {name}", text-fallback), take the first word as a
    // distinctive query token, and type it CHARACTER-BY-CHARACTER into the page's
    // `personas-search` box (located by testid, sidebar-proof) so both the query
    // and the visibly-narrowing grid read on camera. The whole beat is guarded:
    // if there is no readable card name or no search box, it is skipped cleanly.
    const cardName = await facade.library.firstCardName().catch(() => null);
    const term = (cardName ?? "").trim().split(/\s+/)[0]?.trim() ?? "";
    const box = page.getByTestId("personas-search").first();

    if (term.length >= 2 && (await isVisible(box))) {
      await box.scrollIntoViewIfNeeded().catch(() => undefined);
      await box.click({ timeout: 10_000 }).catch(() => undefined);
      await box.fill("");
      // delay ~55ms so the query visibly types in on camera. The search debounces
      // then commits to the URL -> re-fetch; settle waits the resulting shimmer
      // out so the narrowed grid lands on a clean frame.
      await box.pressSequentially(term, { delay: 55 });
      await box.press("Enter");
      await waitOutSkeleton(page);
      // Hold on the narrowed result so the matching persona(s) read on camera.
      await pauseForDemo(1_400);

      // Clear back to the full library so the filter/pagination tour below runs
      // against the unfiltered, multi-page grid.
      await box.fill("");
      await box.press("Enter");
      await waitOutSkeleton(page);
      await pauseForDemo(900);
    }

    // 3) Brief read-only tour of the remaining list controls. skipSearch because
    // the search is driven explicitly above (the headline). exerciseListView then
    // opens the first faceted picker (Scenario/Field/Department — open -> pick ->
    // Escape -> Reset), the card View (column-visibility) toggle, pagination
    // (Next -> Prev), and the page-size selector. Each step is independently
    // guarded so a control the page lacks is skipped cleanly. All reversible.
    await exerciseListView(page, { skipSearch: true });

    // Land the clip back on the populated grid (a settled, full-list frame rather
    // than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    if (await isVisible(grid)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
    }
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "personas-search");
  });
});
