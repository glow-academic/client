import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: SEARCH-LED full-page tour of the evals library (/platform/evals).
// Deliberately distinct from evals-overview (which leads with a grid browse and
// runs the generic exerciseListView search beat): here the CENTERPIECE is the
// search box. We read a REAL, currently-visible eval's name off the loaded grid,
// type its first word into `evals-search` character-by-character so both the
// query and the narrowing grid read on camera, hold on the filtered result, then
// clear back. Only AFTER that headline do we run a brief faceted-filter / card
// View / pagination tour (search step skipped so the typed search above is the
// one and only search beat).
//
// PAGE-READY GATE: facade.library.openIfPopulated() navigates, waits the toolbar
// + grid visible, and (when populated) waits the loading skeleton out — so the
// first recorded frame is the LOADED grid, never a shimmer. The demo skips
// cleanly when the library is empty (no seed data to search). Past that gate
// every beat self-guards (isVisible()/count() bail) so a control or card the
// page lacks is skipped, never failed. Beats:
//   (1) tour the loaded grid and walk a few cards, hovering each card's per-row
//       affordances (Edit/View/Delete — hover only, never click, so we stay on
//       the list and mutate nothing);
//   (2) THE SEARCH HEADLINE — derive a selective term from a real card name,
//       type it char-by-char (pressSequentially, delay ~55) into `evals-search`,
//       settle on the narrowed grid, hold, then clear back to the full list;
//   (3) a brief filter/View/pagination tour via exerciseListView({ skipSearch })
//       — opens the Model/Rubric/Department faceted filters and the card View
//       (column-visibility) menu (open -> reveal -> Reset/close), then pages
//       Next -> Prev and resizes the page.
// All non-destructive — search/filters open-then-reset, links are only hovered,
// Delete is never invoked. Saved once under the canonical "evals-search" name
// (saveDemoVideo closes the page, so it is the final beat).

const PAGE_SEARCH = "evals-search";

/** First word of a string, trimmed of surrounding punctuation, or null if it
 *  isn't ≥2 chars (a 1-char token is no more selective than typing "a"). Keeps
 *  the typed term distinctive so the grid visibly narrows on camera. */
function selectiveTerm(name: string | null): string | null {
  if (!name) return null;
  const word = (name.split(/\s+/)[0] ?? "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return word.trim().length >= 2 ? word.trim() : null;
}

test.describe("demo: evals search", () => {
  test("search the evals library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["eval"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // PAGE-READY GATE: open the list and confirm it's populated (toolbar + grid
    // visible, skeleton settled). Skip — don't fail — when the library is empty
    // or has no search box, since a search demo needs both to be meaningful.
    test.skip(
      !(await facade.library.openIfPopulated()),
      `${spec.plural} library is empty (no seed data to search)`,
    );
    test.skip(!(await facade.library.hasSearch()), `${spec.plural} has no search box`);

    // Trim any residual shimmer before the first beat so no half-loaded frame is
    // recorded.
    await waitOutSkeleton(page);

    // 1) Tour the grid: bring the grid container into frame, then walk the first
    // few cards so the camera reads the library's contents before we search.
    const grid = page.getByTestId("evals-grid").first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const cards = page.getByTestId("eval-card");
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // Surface the per-card affordances on the first card so its Edit / View /
    // Delete controls read on camera — hover only, never click (Edit/View would
    // navigate off the list; Delete mutates).
    await hoverLocatorIfVisible(page.getByTestId(/^btn-edit-eval-/));
    await hoverLocatorIfVisible(page.getByTestId(/^btn-view-eval-/));

    // 2) THE SEARCH HEADLINE. Read a REAL eval name off the loaded grid and type
    // its first word into the page's `evals-search` box character-by-character so
    // the query + the narrowing grid both read on camera. Guarded end-to-end: if
    // no name is readable we fall back to a common letter so the box still shows
    // typing; if the box isn't present (it is — gated above) the whole beat bails.
    const cardName = await facade.library.firstCardName().catch(() => null);
    const term = selectiveTerm(cardName) ?? "a";

    const search = page.getByTestId(PAGE_SEARCH).first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("");
      // Slow, visible typing (delay ~55) so the query appears key-by-key. The
      // search debounces then commits to the URL → re-fetch; settle on the
      // narrowed grid afterwards (skeleton out + a hold beat) so the FILTERED
      // result is what the camera lingers on.
      await search.pressSequentially(term, { delay: 55 }).catch(() => undefined);
      await search.press("Enter").catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(1_400);
      // Hold a touch longer on the narrowed grid so the result reads.
      if (await grid.isVisible().catch(() => false)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
      }
      // Clear back to the full list so the later filter/pagination tour runs
      // against the unfiltered, multi-page grid.
      await search.fill("");
      await search.press("Enter").catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(900);
    }

    // 3) A brief filter / card View / pagination tour. skipSearch: true — the
    // typed search above is the one and only search beat (no duplicate). Each
    // remaining step is independently guarded so a control the page lacks is
    // skipped cleanly: it opens the Model/Rubric/Department faceted filters
    // (open -> pick -> Reset), the card View (column-visibility) toggle, then
    // pages Next -> Prev and resizes the page. All read-only / reversible.
    await exerciseListView(page, { skipSearch: true });

    // Land the clip back on the populated grid (a settled, full-list frame rather
    // than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    await scrollToText(page, /evals|eval card/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "evals-search");
  });
});
