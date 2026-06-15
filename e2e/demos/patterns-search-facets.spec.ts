import { expect, test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: FACETED-FILTERING headline tour of the personas library
// (/training/personas). This is the targeted re-record of patterns-search-facets:
// the prior take leaned on a generic search-controls helper and barely showed the
// facets. Here the CENTERPIECE is the three server-driven faceted filters that
// `Personas.tsx` composes via `ThreePickerFilters` → `DataTableFacetedFilter`
// ("Scenario" / "Field" / "Department"). For EACH filter we: open its popover
// trigger, reveal the option list, type into its server-driven option search box
// (the `CommandInput`, placeholder = the filter title) so the facet's own search
// re-queries on camera, clear that, pick the first real option so the grid
// visibly NARROWS, hold on the filtered result, then click the toolbar "Reset"
// button to clear it back to the full list. Around that headline we also type
// into + clear the page `personas-search` box and walk the grid / pagination.
//
// PAGE-READY GATE: exactly ONE hard assertion — the `personas-toolbar` is visible
// (the library shell rendered + authenticated). After that, EVERY beat self-
// guards (isVisible()/count() bail) so a facet, option, search box, Reset, or
// pagination arrow the page lacks is skipped, never failed. We waitOutSkeleton()
// / settleLoaded() after each re-query so no half-loaded shimmer frame is
// recorded. Strictly NON-DESTRUCTIVE: filters open-then-pick-then-Reset, the
// facet option-search and page search are typed-then-cleared, the facet popover
// is dismissed with Escape — nothing is committed, deleted, or navigated away.

const TOPIC = "patterns-search-facets";

const BEAT = 900;

/** The three server-driven faceted filters `Personas.tsx` renders, by the
 *  accessible name of their popover trigger (an outline button whose text is the
 *  filter title — `DataTableFacetedFilter` has no testid). */
const FACETS = ["Scenario", "Field", "Department"] as const;

/** Settle after a re-query: wait the loading shimmer out (bounded, demo-only)
 *  then hold one presentation beat on the result. */
async function settle(page: Page, beat = BEAT): Promise<void> {
  await waitOutSkeleton(page);
  await pauseForDemo(beat);
}

/**
 * Fully exercise ONE faceted filter, all beats guarded so a missing facet/option
 * is skipped cleanly:
 *   open trigger -> reveal options -> type into the facet's own (server-driven)
 *   CommandInput so it re-queries -> clear that -> pick the first real option so
 *   the grid narrows -> hold -> Escape to dismiss the popover -> click toolbar
 *   "Reset" to return to the full, multi-page list.
 */
async function exerciseFacet(page: Page, title: string): Promise<void> {
  const trigger = page.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(BEAT);

  // The popover's option-search box (`CommandInput`) carries the filter title as
  // its placeholder. Type a couple letters into it so the SERVER-DRIVEN option
  // search visibly re-queries the facet's option list on camera, then clear it
  // back so the full option set returns before we pick.
  const facetSearch = page.getByPlaceholder(title).first();
  if (await facetSearch.isVisible().catch(() => false)) {
    await facetSearch.click({ timeout: 10_000 }).catch(() => undefined);
    await facetSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
    await pauseForDemo(BEAT);
    await facetSearch.fill("").catch(() => undefined);
    await pauseForDemo(600);
  }

  // Options are `CommandItem`s (role "option"). The "Clear filters" row only
  // appears once something is selected, so the first option here is a real facet
  // value. Picking it commits the filter to the URL → server re-fetch; the grid
  // narrows. The popover stays open, so dismiss it with Escape before we settle.
  const option = page.getByRole("option").first();
  if (await option.isVisible().catch(() => false)) {
    await option.click({ timeout: 10_000 }).catch(() => undefined);
    await pauseForDemo(BEAT);
    await page.keyboard.press("Escape").catch(() => undefined);
    await settle(page);

    // Hold on the narrowed grid so the filtered result reads on camera.
    const grid = page.getByTestId("personas-grid").first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
    }

    // Reset: the toolbar's "Reset" button (text "Reset" + ✕) shows only while a
    // filter/search is active. Clicking it clears the column filter AND the URL
    // params, returning the grid to its full multi-page state. Falls back to a
    // second Escape if Reset isn't present (e.g. the pick didn't take).
    const reset = page.getByRole("button", { name: /reset/i }).first();
    if (await reset.isVisible().catch(() => false)) {
      await reset.scrollIntoViewIfNeeded().catch(() => undefined);
      await reset.click({ timeout: 10_000 }).catch(() => undefined);
      await settle(page);
    }
  } else {
    // No options to pick — close the popover and bail without failing.
    await page.keyboard.press("Escape").catch(() => undefined);
    await pauseForDemo(400);
  }
}

test.describe("demo: patterns search facets", () => {
  test("records faceted filtering on the personas library", async ({ page }) => {
    // PAGE-READY GATE — the ONE hard assertion. Navigate, confirm we're
    // authenticated (not bounced to signin), and wait the toolbar shell visible.
    await page.goto("/training/personas");
    await expectAuthenticated(page);
    await expect(page.getByTestId("personas-toolbar")).toBeVisible({ timeout: 30_000 });

    // Trim the loading shimmer + tour the loaded grid so the first recorded
    // frames are the populated library, not a skeleton.
    await settleLoaded(page, { scrollTexts: [/persona|filter|scenario|field|department/i] });

    // Walk the first couple of cards so the camera reads the library's contents
    // before we start filtering. Guarded — skipped on an empty library.
    const cards = page.getByTestId("persona-card");
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 2); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(700);
    }

    // ---- THE FACETED-FILTERING HEADLINE ---------------------------------
    // Exercise each of the three server-driven faceted filters in turn: open ->
    // reveal options -> type into the facet's own option search -> clear -> pick
    // first option (grid narrows) -> hold -> Reset back to the full list.
    for (const facet of FACETS) {
      await exerciseFacet(page, facet);
    }

    // ---- PAGE SEARCH BOX -------------------------------------------------
    // Type into the `personas-search` box character-by-character (so the query
    // shows on camera), let the debounced search commit + re-fetch, settle on the
    // narrowed grid, then clear back to the full list. Guarded end to end.
    const search = page.getByTestId("personas-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("");
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await search.press("Enter").catch(() => undefined);
      await settle(page, 1_200);
      await search.fill("");
      await search.press("Enter").catch(() => undefined);
      await settle(page);
    }

    // ---- PAGINATION ------------------------------------------------------
    // Page Next -> Prev (guarded) so the grid visibly advances. The arrows carry
    // sr-only names and are duplicated across mobile/desktop layouts, so take the
    // first VISIBLE match. Skips cleanly on a single-page (disabled Next) list.
    const next = page.getByRole("button", { name: /next page/i }).filter({ visible: true }).first();
    if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click({ timeout: 10_000 }).catch(() => undefined);
      await settle(page);
      const prev = page
        .getByRole("button", { name: /previous page/i })
        .filter({ visible: true })
        .first();
      if ((await prev.isVisible().catch(() => false)) && (await prev.isEnabled().catch(() => false))) {
        await prev.click({ timeout: 10_000 }).catch(() => undefined);
        await settle(page);
      }
    }

    // Land the clip on a settled, full-list frame so the recording ends
    // substantive rather than mid-interaction.
    await waitOutSkeleton(page);
    await scrollToText(page, /persona|filter/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording — final beat.
    await saveDemoVideo(page, TOPIC);
  });
});
