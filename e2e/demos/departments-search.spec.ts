import { test } from "../fixtures";
import { exerciseListView } from "../helpers/exercise-list";
import { waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: SEARCH-LED tour of the departments library (/platform/departments).
// SISTER to departments-overview, but its centerpiece is the NAME SEARCH: it
// types a REAL, data-derived matching term char-by-char so the grid visibly
// narrows on camera, holds on the filtered result, then clears back — the
// affordance departments-overview only touches in passing.
//
// PAGE-READY GATE: we drive the `departments` DomainFacade's shared library
// directly (the same engine the correctness specs use). `openIfPopulated()`
// navigates, waits the toolbar + grid visible, then waits the loading skeleton
// OUT (so the first recorded frame is the LOADED grid, never a shimmer) and
// returns false on an empty library — we test.skip cleanly then (no data to
// search). We then assert the search box exists (skip if not). That single
// page-ready gate is the ONE hard assertion; EVERY beat after it is
// independently GUARDED (isVisible()/count() bail) so a control or card the
// page lacks is skipped, never failed.
//
// All NON-DESTRUCTIVE: search types-then-clears, faceted filters
// open-then-Escape (no commit), the View toggle flips off->on->closes, and
// pagination returns to page 1 — links / Duplicate / Delete are never touched.
// One save, under the canonical "departments-search" name.

const SEARCH_TESTID = "departments-search";
const GRID_TESTID = "departments-grid";
const CARD_TESTID = "department-card";

/**
 * Read a SELECTIVE, REAL search term from the first visible department card so
 * typing it visibly narrows the grid (rather than a near-universal letter).
 * Every card carries aria-label "department card {name}", so strip the prefix
 * and take the first ≥2-char word. Fully guarded — returns null on any miss
 * (no card, ghost/placeholder label, too-short word) so the caller falls back.
 */
async function deriveDepartmentTerm(
  page: import("@playwright/test").Page,
): Promise<string | null> {
  const card = page.getByTestId(CARD_TESTID).first();
  if (!(await card.isVisible().catch(() => false))) return null;
  const label = (await card.getAttribute("aria-label").catch(() => null)) ?? "";
  const name = label.replace(/^department\s+card\s+/i, "").trim();
  // Skip ghost/placeholder labels — they aren't real, filterable data.
  if (!name || /^(Generating|Unnamed\b)/i.test(name)) return null;
  const word = (name.split(/\s+/)[0] ?? "").replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );
  return word.trim().length >= 2 ? word.trim() : null;
}

test.describe("demo: departments search", () => {
  test("search the departments library", async ({ departments, page }) => {
    // PAGE-READY GATE — navigate + wait the loaded grid (skeleton settled).
    // Skip cleanly when the library is empty (nothing to search).
    test.skip(
      !(await departments.library.openIfPopulated()),
      "departments library is empty (no data to search)",
    );
    test.skip(
      !(await departments.library.hasSearch()),
      "departments library has no search box",
    );

    // Trim any residual shimmer before the first beat so no half-loaded frame
    // is recorded.
    await waitOutSkeleton(page);

    // 1) Bring the grid into frame so the camera reads the FULL library before
    // we narrow it — the "before" state of the search.
    const grid = page.getByTestId(GRID_TESTID).first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // 2) CENTERPIECE — the name search. The departments search box is a
    // CLIENT-SIDE TanStack column filter on the name column (it calls
    // `nameColumn.setFilterValue` on every keystroke), so the grid narrows LIVE
    // as each character lands — no Enter / debounce / re-fetch. We type a REAL
    // matching term derived from a visible card so the result set is visibly
    // non-empty, hold so the narrowed grid reads, then clear back to the full
    // list. Guarded: if no derivable term, fall back to a common letter.
    const box = page.getByTestId(SEARCH_TESTID).first();
    if (await box.isVisible().catch(() => false)) {
      const term = (await deriveDepartmentTerm(page).catch(() => null)) ?? "a";
      await box.scrollIntoViewIfNeeded().catch(() => undefined);
      await box.click({ timeout: 10_000 }).catch(() => undefined);
      await box.fill("");
      // Type char-by-char (delay ~55) so the term visibly appears and the grid
      // narrows keystroke-by-keystroke on camera.
      await box.pressSequentially(term, { delay: 55 }).catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(1_400);
      // Hold on the narrowed grid (read-only) before clearing.
      if (await grid.isVisible().catch(() => false)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(700);
      }
      // Clear back to the full list so the later tour runs unfiltered.
      await box.fill("");
      await waitOutSkeleton(page);
      await pauseForDemo(1_000);
    }

    // 3) Brief read-only control tour, each step independently guarded inside
    // exerciseListView. SKIP its generic search step (we just drove search
    // ourselves, char-by-char, above) and its generic faceted-filter step (the
    // departments pickers are titled Profile/Settings/Logins — names the shared
    // regex doesn't match; we exercise them explicitly in beat 4). What remains:
    // the card View (column-visibility) toggle (off->on->close), pagination
    // (Next -> Prev, returns to page 1), and the page-size selector.
    await exerciseListView(page, { skipSearch: true, skipFilters: true });

    // 4) The departments-specific faceted filters (a ThreePickerFilters bar:
    // Profile / Settings / Logins). Open each picker, reveal its option list,
    // then dismiss with Escape WITHOUT selecting anything (no committed filter,
    // no side effect). Each is independently guarded so an absent / empty-option
    // picker is skipped cleanly.
    for (const title of ["Profile", "Settings", "Logins"]) {
      const trigger = page.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
      if (!(await trigger.isVisible().catch(() => false))) continue;
      await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await trigger.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(900);
      const option = page.getByRole("option").first();
      if (await option.isVisible().catch(() => false)) {
        await pauseForDemo(700);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // Land the clip back on the full, settled grid (not mid-interaction) so the
    // recording ends substantive.
    await waitOutSkeleton(page);
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }

    await saveDemoVideo(page, "departments-search");
  });
});
