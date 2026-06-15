// coverage: scenarios-search — SEARCH-LED tour of the scenarios library.
//
// Centerpiece: type a REAL token of a seeded scenario's name into the page
// search box character-by-character (so the typing reads on camera), let the
// grid visibly NARROW, hold, then clear back to the full grid. After that a
// brief, fully-guarded tour of the OTHER list affordances (faceted filters,
// the card View toggle, pagination, page-size) — search is exercised by hand
// above, so it is skipped in the shared helper to avoid a double-type.
//
// Distinct from scenarios-overview (which leads with a scroll-through browse):
// here the narrowing query is the star. Everything past the one page-ready
// assertion is guarded (visible()/count() bails) and strictly NON-DESTRUCTIVE
// (open-then-clear / open-then-Escape; nothing is committed or deleted).

import { test } from "../fixtures";

import { expectAuthenticated, settleLoaded, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
import { exerciseListView } from "../helpers/exercise-list";

const SCENARIOS_SEARCH = "scenarios-search";
const SCENARIO_CARD = "scenario-card";

test.describe("demo: scenarios search", () => {
  test("search the scenarios library", async ({ page, scenarios }) => {
    // ---- Open the populated library (the ONE hard page-ready gate) ----
    test.skip(
      !(await scenarios.library.openIfPopulated()),
      "scenarios library is empty (no seed data to search)",
    );
    await expectAuthenticated(page);
    // Trim any opening shimmer so the LOADED grid is what first reads.
    await settleLoaded(page);

    const searchBox = page.getByTestId(SCENARIOS_SEARCH);
    const cards = page.getByTestId(SCENARIO_CARD);

    // ---- CENTERPIECE: type a REAL matching scenario term → grid narrows ----
    // Derive a selective query from the first seeded card's name so the grid
    // genuinely filters on a term that matches at least that row. Guarded: if
    // the box or a usable name is absent we fall back to a common letter so the
    // typing still reads, and bail cleanly if there's no search box at all.
    if (await searchBox.isVisible().catch(() => false)) {
      const realName = await scenarios.library.firstCardName().catch(() => null);
      const term = pickSelectiveTerm(realName) ?? "a";

      const before = await cards.count().catch(() => 0);

      await searchBox.scrollIntoViewIfNeeded().catch(() => undefined);
      await searchBox.click({ timeout: 10_000 }).catch(() => undefined);
      await searchBox.fill("");
      // pressSequentially with a delay so each character lands on camera.
      await searchBox.pressSequentially(term, { delay: 55 });
      await searchBox.press("Enter");
      // The search debounces then re-queries → grid re-renders; wait the
      // resulting shimmer out before holding so no skeleton frame is captured.
      await waitOutSkeleton(page);
      // Hold on the NARROWED grid so the filtered result reads clearly.
      await pauseForDemo(1_600);

      const after = await cards.count().catch(() => 0);
      // Non-fatal sanity beat: the narrowed count is what the camera shows; we
      // don't assert it (a single-card seed could already be at the floor), the
      // hold above is what makes the narrowing legible.
      void before;
      void after;

      // ---- Clear back to the full grid (non-destructive reset) ----
      await searchBox.fill("");
      await searchBox.press("Enter");
      await waitOutSkeleton(page);
      await pauseForDemo(1_000);
    }

    // ---- Brief tour of the OTHER affordances (search done by hand above) ----
    // Each step is independently guarded inside the helper, so a control this
    // page lacks is skipped, not failed. skipSearch avoids re-typing the box.
    await exerciseListView(page, { skipSearch: true, beat: 900 });

    await saveDemoVideo(page, SCENARIOS_SEARCH);
  });
});

/**
 * Pick a SELECTIVE search token from a scenario's display name: the first word
 * that is ≥2 chars (so it actually narrows, vs. a near-universal single char).
 * Returns null on an empty/unusable name so the caller can fall back.
 */
function pickSelectiveTerm(name: string | null): string | null {
  if (!name) return null;
  for (const raw of name.split(/\s+/)) {
    const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (word.length >= 2) return word;
  }
  return null;
}
