import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: SEARCH-LED full-page tour of the cohorts library
// (/training/cohorts). Distinct from cohorts-overview (which leads with the
// top->bottom grid tour + the single-delete dialog): HERE the centerpiece is
// the SEARCH box. We derive a REAL term from a seeded cohort's name, type it
// into `cohorts-search` character-by-character so the query reads on camera,
// let the grid visibly NARROW, hold on the filtered result, then clear back to
// the full library. A brief filter/pagination tour follows.
//
// PAGE-READY GATE (the ONE hard gate): facade.library.openIfPopulated()
// navigates, waits the toolbar + `cohorts-grid` visible, and (when populated)
// waits the loading skeleton out — so the first recorded frame is the LOADED
// grid, never a shimmer. The demo skips cleanly when the library is empty (a
// search demo needs data to narrow). Past that gate EVERY beat self-guards
// (isVisible()/count() bail) so a control or card the page lacks no-ops rather
// than fails, and skeletons are settled out before each beat. All
// NON-DESTRUCTIVE: search types-then-clears, filters open-then-Escape/Reset,
// pagination is reversible, and no card action (Edit/View/Duplicate/Delete) is
// ever clicked. Saved once under the canonical "cohorts-search" name
// (saveDemoVideo closes the page, so it is the final beat).

/** Derive a SELECTIVE search token from a visible cohort card so the grid
 *  visibly narrows on camera. The cohort card carries `aria-label="{name}"`
 *  directly (Cohorts.tsx), so read that (fall back to text), take the first
 *  word ≥2 chars. Fully guarded: returns null on any miss so the caller falls
 *  back to a generic term. Never throws. */
async function firstCohortTerm(page: import("@playwright/test").Page): Promise<string | null> {
  const card = page.getByTestId("cohort-card").first();
  if (!(await card.isVisible().catch(() => false))) return null;
  const label =
    (await card.getAttribute("aria-label").catch(() => null)) ??
    (await card.textContent().catch(() => null)) ??
    "";
  const word = (label.trim().split(/\s+/)[0] ?? "").replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );
  if (/^(Generating|Unnamed)$/i.test(word)) return null;
  return word.length >= 2 ? word : null;
}

test.describe("demo: cohorts search", () => {
  test("search the cohorts library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["cohort"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // ---- PAGE-READY GATE (the ONE hard gate) -------------------------
    // Open the list and confirm it's populated (toolbar + grid visible,
    // skeleton settled). Skip — don't fail — when empty: a search demo
    // needs data to narrow.
    test.skip(
      !(await facade.library.openIfPopulated()),
      `${spec.plural} library is empty (no seed data to search)`,
    );
    await waitOutSkeleton(page);

    // Bring the grid into frame so the full library reads before we narrow it.
    const grid = page.getByTestId("cohorts-grid").first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // ---- 1. SEARCH: the centerpiece ----------------------------------
    // Derive a real term from a seeded cohort, type it into `cohorts-search`
    // character-by-character (so the query appears on camera), let the grid
    // narrow (the box debounces ~500ms then commits to the URL → re-fetch),
    // hold on the filtered result, then clear back to the full library.
    const box = page.getByTestId("cohorts-search").first();
    if (await box.isVisible().catch(() => false)) {
      const term = (await firstCohortTerm(page).catch(() => null)) ?? "cohort";
      await box.scrollIntoViewIfNeeded().catch(() => undefined);
      await box.click({ timeout: 10_000 }).catch(() => undefined);
      await box.fill("");
      await box.pressSequentially(term, { delay: 55 });
      await box.press("Enter");
      // Settle on the NARROWED grid and hold so the filtered result reads.
      await waitOutSkeleton(page);
      await pauseForDemo(1400);

      // Clear back to the full list so the later tour runs unfiltered.
      await box.fill("");
      await box.press("Enter");
      await waitOutSkeleton(page);
      await pauseForDemo(900);
    }

    // ---- 2. The cohort-specific faceted pickers ----------------------
    // Cohorts expose Simulation / Profile / Department faceted pickers (the
    // shared filter step only knows the generic titles). Open each, let its
    // options render, dismiss with Escape WITHOUT selecting (read-only reveal,
    // no filter committed). Each is independently guarded.
    for (const title of ["Simulation", "Profile", "Department"] as const) {
      const trigger = page.getByRole("button", { name: title, exact: true }).first();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click({ timeout: 10_000 }).catch(() => undefined);
        await pauseForDemo(900);
        await page.getByRole("option").first().isVisible().catch(() => false);
        await pauseForDemo(700);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    // ---- 3. Brief list tour: View toggle + pagination ----------------
    // Search already led the clip, so skip exerciseListView's search +
    // faceted-filter steps (the latter we drove explicitly above) and just
    // exercise the card View (column-visibility) toggle and pagination
    // (Next -> Prev). Each step self-guards and is reversible.
    await exerciseListView(page, { skipSearch: true, skipFilters: true, skipPageSize: true });

    // ---- 4. Land on the settled, full grid ---------------------------
    await waitOutSkeleton(page);
    await scrollToText(page, /cohorts grid|members/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "cohorts-search");
  });
});
