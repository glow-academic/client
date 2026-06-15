import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: SEARCH-LED full-page tour of the simulations library
// (/training/simulations) — distinct from simulations-overview, whose centerpiece
// is the grid/card walk. Here the headline is the SEARCH itself: type a REAL term
// derived from an on-screen simulation's name into the page `simulations-search`
// box character-by-character (so the query AND the narrowing grid both read on
// camera), hold on the filtered grid, then clear it back to the full library.
//
// PAGE-READY GATE: facade.library.openIfPopulated() navigates, waits the toolbar
// + grid visible, and (when populated) waits the loading skeleton out — so the
// first recorded frame is the LOADED grid, never a shimmer. The demo skips
// cleanly when the library is empty (a search demo needs data to narrow). Past
// that gate every beat self-guards (visible()/count() bail) so a control or card
// the page lacks is skipped, never failed. Beats:
//   (1) brief tour of the loaded grid + a couple cards, surfacing each card's
//       per-row affordances (Edit/View/Duplicate/Delete — hover only, never
//       click, so we stay on the list);
//   (2) THE CENTERPIECE — derive a selective first-word term from a visible
//       simulation card, type it into `simulations-search` (delay ~55ms so the
//       query appears), let the debounced re-query land, hold on the narrowed
//       grid, then clear back to the full list (settle out the shimmer each way);
//   (3) a brief filter/pagination tour via exerciseListView with its own search
//       step SKIPPED (we already led with the real search) — it opens the
//       Scenario/Cohort/Department faceted filters (open -> pick -> Reset), the
//       card View (column-visibility) toggle, pagination (Next -> Prev), and the
//       page-size selector, each independently guarded.
// All NON-DESTRUCTIVE — search/filters open-then-reset, per-card links are only
// hovered, Duplicate/Delete are never invoked. After any re-query the loading
// shimmer is settled out before the next beat so no skeleton frame is recorded.
// Saved once under the search slot's canonical "simulations-search" name
// (saveDemoVideo closes the page, so it is the final beat).

test.describe("demo: simulations search", () => {
  test("search the simulations library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["simulation"]!;
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

    // 1) Brief tour of the loaded grid + a couple cards so the camera reads the
    // library's contents (names, AI/Practice/Inactive badges, cohort counts)
    // before the search narrows it.
    const grid = page.getByTestId("simulations-grid").first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const cards = page.getByTestId("simulation-card");
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 2); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // Surface the per-card affordances on the first card so the row's
    // Edit / View / Duplicate / Delete controls read on camera — hover only,
    // never click (clicking Edit/View would navigate off the list; Duplicate/
    // Delete mutate). can_edit rows show Edit, can_edit==false rows show View.
    await hoverLocatorIfVisible(page.getByTestId("btn-edit-simulation"));
    await hoverLocatorIfVisible(page.getByTestId("btn-view-simulation"));
    await hoverLocatorIfVisible(page.getByTestId("btn-duplicate-simulation"));
    await hoverLocatorIfVisible(page.getByTestId("btn-delete-simulation"));

    // 2) THE CENTERPIECE — search. Derive a SELECTIVE term from a visible card's
    // name so the grid visibly narrows on camera (rather than a near-universal
    // letter). Every simulation card carries `aria-label="simulation card {name}"`
    // (the uniform artifact-card label), so read it, strip the prefix, take the
    // first ≥2-char word. Fully guarded: any miss falls back to "sim" — a token
    // that still matches the seeded simulation library so the filtered grid stays
    // visibly non-empty.
    const term = await deriveSimTerm(page);

    const box = page.getByTestId("simulations-search").first();
    if (await box.isVisible().catch(() => false)) {
      await box.scrollIntoViewIfNeeded().catch(() => undefined);
      await box.click({ timeout: 10_000 }).catch(() => undefined);
      await box.fill("");
      // Type character-by-character (delay ~55ms) so the query appears on camera.
      // The search debounces (~500ms) then commits to the URL → re-fetch, so we
      // settle the resulting shimmer out before holding on the narrowed grid.
      await box.pressSequentially(term, { delay: 55 }).catch(() => undefined);
      await box.press("Enter").catch(() => undefined);
      await waitOutSkeleton(page);
      // Hold on the narrowed grid so the search result reads clearly.
      await pauseForDemo(1500);

      // Clear back to the full library so the brief filter/pagination tour below
      // runs against the unfiltered (multi-page) grid.
      await box.fill("");
      await box.press("Enter").catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(900);
    }

    // 3) Brief filter/pagination tour. SKIP exerciseListView's own search step —
    // we already led with the real search above and don't want to repeat it. The
    // remaining steps each self-guard: the Scenario/Cohort/Department faceted
    // filters (open -> pick -> Reset), the card View (column-visibility) toggle,
    // pagination (Next -> Prev), and the page-size selector. All read-only /
    // reversible — the filter step picks an option then clicks the toolbar Reset,
    // restoring the full unfiltered grid.
    await exerciseListView(page, { skipSearch: true });

    // Land the clip back on the populated grid (a settled, full-list frame rather
    // than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    await scrollToText(page, /simulations/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "simulations-search");
  });
});

/**
 * Derive a SELECTIVE search term from the first visible simulation card's name so
 * the search step visibly narrows the grid. Reads the uniform
 * `aria-label="simulation card {name}"`, strips the prefix, and takes the first
 * ≥2-char word. Fully guarded: returns "sim" on any miss (no card, unreadable
 * label, ghost/placeholder, too-short word) so a non-empty term always lands.
 */
async function deriveSimTerm(page: import("@playwright/test").Page): Promise<string> {
  const fallback = "sim";
  const card = page.locator('[aria-label*=" card "]').first();
  if (!(await card.isVisible().catch(() => false))) return fallback;
  const label = (await card.getAttribute("aria-label").catch(() => null)) ?? "";
  const name = label.replace(/^.*?\scard\s/i, "").trim();
  if (!name || /^(Generating|Unnamed\b)/i.test(name)) return fallback;
  const word = (name.split(/\s+/)[0] ?? "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return word.trim().length >= 2 ? word.trim() : fallback;
}
