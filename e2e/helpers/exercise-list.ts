// exerciseListView — the shared "make the list view DO things on camera" helper.
//
// The bar for a good list-page demo: it must visibly demonstrate that search,
// filters, the card View toggle, pagination arrows, and the page-size selector
// all WORK — not just scroll past a static grid. This helper drives each of
// those affordances with demo pacing (a `pauseForDemo()` beat between steps so
// every interaction lands on frame) and waits the loading shimmer out between
// them so the camera never catches a half-loaded grid.
//
// GLOW's artifact list pages are strikingly uniform — they all compose the same
// shared widgets (the `{plural}-search` input, `ThreePickerFilters` →
// `DataTableFacetedFilter`, `DataTableViewOptions`, `DataTablePagination`) — so
// one parameterized helper exercises personas, agents, rubrics, … alike.
//
// EVERY step is GUARDED: a control that isn't present on a given page (a library
// with no filters, a single page so no pagination, a mobile-hidden View button)
// is skipped cleanly via `.first()` + `count()`/`isVisible()` checks. The helper
// never hard-fails on a missing OPTIONAL affordance — it only does what the page
// actually offers, so a demo can call `await exerciseListView(page)` bare.
//
// Like the rest of the demo stack the pacing is gated on PLAYWRIGHT_DEMO via
// `pauseForDemo()` / `waitOutSkeleton()`, so the same code runs fast (and still
// guard-safe) under plain correctness mode.

import { type Locator, type Page } from "@playwright/test";

import { pauseForDemo } from "./demo-video";
import { waitOutSkeleton } from "./demo-page";

export interface ExerciseListOptions {
  /** Search term to type. When omitted, the search step first tries to derive a
   *  SELECTIVE term from the first visible card's name (so the grid visibly
   *  narrows on camera); if no card name is readable it falls back to this value
   *  and, failing that, to "a" — a single common letter that matches most
   *  seeded libraries so the filtered grid is still visibly non-empty. */
  searchTerm?: string;
  /** Skip the search step. */
  skipSearch?: boolean;
  /** Skip the faceted-filter step. */
  skipFilters?: boolean;
  /** Skip the card View (column-visibility) toggle step. */
  skipViewToggle?: boolean;
  /** Skip the pagination next/prev step. */
  skipPagination?: boolean;
  /** Skip the page-size selector step. */
  skipPageSize?: boolean;
  /** Per-beat pause (ms) used between interactions. Defaults to 900ms — long
   *  enough that each action reads clearly on camera. */
  beat?: number;
}

/** True when the locator resolves to at least one attached element. */
async function present(locator: Locator): Promise<boolean> {
  return (await locator.count().catch(() => 0)) > 0;
}

/** True when the (first) locator is attached AND visible. */
async function visible(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

/** Settle after an interaction: wait the loading shimmer out (bounded,
 *  demo-mode-only) then hold one presentation beat on the result. */
async function settle(page: Page, beat: number): Promise<void> {
  await waitOutSkeleton(page);
  await pauseForDemo(beat);
}

/**
 * Drive a list view's interactive affordances for the camera.
 *
 * Call AFTER the page has loaded and the grid has been asserted on screen
 * (e.g. the overview demo's `library.openIfPopulated()` + `browse()`).
 *
 * Steps, each independently guarded and skippable:
 *   1. SEARCH    — type a term, settle on the filtered grid, then clear.
 *   2. FILTERS   — open the first faceted filter, pick its first option, settle
 *                  on the filtered grid, then click the toolbar "Reset" button
 *                  to clear the filter (returning the grid to full/multi-page).
 *   3. VIEW      — open the "View" column-visibility menu, toggle the first
 *                  card feature off, pause, toggle it back on, close.
 *   4. PAGINATE  — click Next (if enabled), settle, then Prev, settle.
 *   5. PAGE SIZE — open the page-size selector and choose a different value.
 */
export async function exerciseListView(
  page: Page,
  opts: ExerciseListOptions = {},
): Promise<void> {
  const beat = opts.beat ?? 900;

  if (!opts.skipSearch) await exerciseSearch(page, opts.searchTerm, beat);
  if (!opts.skipFilters) await exerciseFilters(page, beat);
  if (!opts.skipViewToggle) await exerciseViewToggle(page, beat);
  if (!opts.skipPagination) await exercisePagination(page, beat);
  if (!opts.skipPageSize) await exercisePageSize(page, beat);
}

// ---- Step 1: search ----------------------------------------------------

/**
 * Derive a SELECTIVE search term from the first visible card on the page so the
 * SEARCH step visibly narrows the grid (rather than typing a near-universal "a"
 * that matches nearly every row). Every artifact card carries a uniform
 * `aria-label="{domain} card {name}"` (verified across personas/agents/rubrics/
 * …), so we read that, strip the "{domain} card " prefix, and take the first
 * word of the actual name — distinctive enough to filter to ≥ that card.
 *
 * Fully guarded: returns null on any miss (no card, unreadable label, empty
 * name) so the caller falls back to the supplied term / "a". Never throws.
 */
async function deriveSelectiveTerm(page: Page): Promise<string | null> {
  const card = page.locator('[aria-label*=" card "]').first();
  if (!(await visible(card))) return null;
  const label = (await card.getAttribute("aria-label").catch(() => null)) ?? "";
  // "{domain} card {name}" → take everything after the first " card ".
  const name = label.replace(/^.*?\scard\s/i, "").trim();
  // Skip the ghost/placeholder labels ("… card Generating", "Unnamed …") — they
  // aren't real, filterable data, so fall back rather than search for them.
  if (!name || /^(Generating|Unnamed\b)/i.test(name)) return null;
  // First word, trimmed of leading/trailing punctuation. Require ≥2 chars so the
  // term is meaningfully selective (a 1-char token is no better than "a").
  const word = (name.split(/\s+/)[0] ?? "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return word.length >= 2 ? word : null;
}

/**
 * Type a term into the list's search box, settle on the filtered grid, then
 * clear it back. The box is the shared list search `<input>` (the only
 * top-level search input on these pages); we locate it by its placeholder so
 * the helper stays domain-agnostic. Skips cleanly if no search box is present.
 *
 * The term is SELECTIVE: we prefer a distinctive word derived from a currently-
 * visible card (so the grid visibly narrows on camera), guarded with a fallback
 * to the caller-supplied `searchTerm` and finally to "a".
 */
async function exerciseSearch(page: Page, searchTerm: string | undefined, beat: number): Promise<void> {
  // Every artifact list search renders placeholder text starting with "Search"
  // ("Search system agents…", "Search personas…", "Search providers…", …) —
  // verified uniform across all artifact toolbars. We target by placeholder
  // rather than the `{plural}-search` testid because that testid suffix is NOT
  // universal (providers uses `input-search-providers`), and rather than an
  // accessible name (most inputs expose only the placeholder, no /search/i
  // aria-label), which is why the old role+name locator silently missed.
  const box = page.getByPlaceholder(/search/i).first();
  if (!(await visible(box))) return;

  // Resolve the term to type: prefer a distinctive word from a visible card (so
  // the grid visibly narrows), else the caller-supplied term, else "a". The
  // derivation is fully guarded and never throws, so any failure just falls back.
  const term = (await deriveSelectiveTerm(page).catch(() => null)) ?? searchTerm ?? "a";

  await box.scrollIntoViewIfNeeded().catch(() => undefined);
  await box.click({ timeout: 10_000 }).catch(() => undefined);
  // Type character-by-character so the term visibly appears on camera. The
  // search debounces (~500ms) then commits to the URL → re-fetch, so settle
  // afterwards waits the resulting shimmer out.
  await box.fill("");
  await box.pressSequentially(term, { delay: 40 });
  await box.press("Enter");
  await settle(page, beat);

  // Clear back to the full list so later steps run against the unfiltered grid.
  await box.fill("");
  await box.press("Enter");
  await settle(page, beat);
}

// ---- Step 2: faceted filters -------------------------------------------

/**
 * Open the first faceted filter (a `DataTableFacetedFilter` popover — its
 * trigger is an outline button whose accessible name is the filter title, e.g.
 * "Tool"/"Model"/"Department"), pick its first option (a `CommandItem`, role
 * `option`), settle on the filtered grid, then click the toolbar "Reset" button
 * to clear the applied filter. Skips cleanly if no filter trigger / no options
 * are present.
 */
async function exerciseFilters(page: Page, beat: number): Promise<void> {
  // The filter triggers are the buttons inside the toolbar carrying the dashed
  // outline + a leading PlusCircle. We can't key off the icon, so target by the
  // popover they own: a button whose click reveals an option list. Use the
  // known artifact-list titles, falling back to nothing if none match.
  const trigger = page
    .getByRole("button", { name: /^(Tool|Model|Department|Status|Type|Role|Provider|Protocol)$/ })
    .first();
  if (!(await visible(trigger))) return;

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(beat);

  // Options are CommandItems (role "option"). The "Clear filters" row only
  // appears once something is selected, so the first option here is a real
  // facet value.
  const option = page.getByRole("option").first();
  if (!(await visible(option))) {
    // No options to pick — close the popover and bail without failing.
    await page.keyboard.press("Escape").catch(() => undefined);
    return;
  }
  await option.click({ timeout: 10_000 }).catch(() => undefined);
  // Selecting commits the filter to the URL → re-fetch; the popover stays open.
  await pauseForDemo(beat);
  await page.keyboard.press("Escape").catch(() => undefined);
  await settle(page, beat);

  // Reset: the toolbar renders a "Reset" button (text "Reset" + an ✕ icon),
  // shown only while `isFiltered`. Clicking it calls `table.resetColumnFilters()`
  // AND resets the URL params to `page: 0` — i.e. it fully clears the applied
  // filter and returns the grid to its full (multi-page) state. This is what
  // un-pins the grid from "Page 1 of 1" so the later pagination step has a Next
  // page to move to. (The `DataTableFacetedFilter` popover's "Clear filters"
  // CommandItem only clears the column locally and was the silent miss before.)
  const reset = page.getByRole("button", { name: /reset/i }).first();
  if (await visible(reset)) {
    await reset.scrollIntoViewIfNeeded().catch(() => undefined);
    await reset.click({ timeout: 10_000 }).catch(() => undefined);
    await settle(page, beat);
  }
}

// ---- Step 3: card View (column-visibility) toggle ----------------------

/**
 * Open the "View" menu (`DataTableViewOptions` — an outline button labelled
 * "View" that opens a dropdown of `menuitemcheckbox` rows controlling which
 * card features show), toggle the first feature off → pause → back on, then
 * close. The button is `lg:flex hidden` and returns null on mobile, so this
 * skips cleanly on a narrow viewport. Toggling a checkbox keeps the menu open,
 * so both clicks hit the same row.
 */
async function exerciseViewToggle(page: Page, beat: number): Promise<void> {
  const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
  if (!(await visible(viewBtn))) return;

  await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await viewBtn.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(beat);

  const item = page.getByRole("menuitemcheckbox").first();
  if (!(await visible(item))) {
    await page.keyboard.press("Escape").catch(() => undefined);
    return;
  }
  // Hide the feature → the cards visibly lose that badge/section, then restore.
  await item.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(beat);
  // Radix keeps the menu open after a checkbox toggle; the same row toggles back.
  if (await visible(item)) {
    await item.click({ timeout: 10_000 }).catch(() => undefined);
    await pauseForDemo(beat);
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await settle(page, beat);
}

// ---- Step 4: pagination ------------------------------------------------

/**
 * Click the pagination Next arrow → settle → Prev arrow → settle, scoped to the
 * `aria-label="pagination controls"` container so the duplicated mobile/desktop
 * layouts don't trip strict mode (we take the first VISIBLE match). The arrows
 * carry sr-only accessible names ("Go to next page" / "Go to previous page").
 * Skips cleanly when there's a single page (Next is disabled) or no pagination.
 */
async function exercisePagination(page: Page, beat: number): Promise<void> {
  const controls = page.getByLabel("pagination controls").first();
  if (!(await present(controls))) return;

  const next = controls.getByRole("button", { name: /next page/i }).filter({ visible: true }).first();
  if (!(await visible(next))) return;
  // Only paginate if there IS a next page — a single-page list disables it.
  if (!(await next.isEnabled().catch(() => false))) return;

  await next.scrollIntoViewIfNeeded().catch(() => undefined);
  await next.click({ timeout: 10_000 }).catch(() => undefined);
  await settle(page, beat);

  const prev = controls.getByRole("button", { name: /previous page/i }).filter({ visible: true }).first();
  if (await visible(prev)) {
    await prev.click({ timeout: 10_000 }).catch(() => undefined);
    await settle(page, beat);
  }
}

// ---- Step 5: page-size selector ----------------------------------------

/**
 * Open the page-size selector (a Radix `Select` in `DataTablePagination`,
 * rendered as a `combobox` trigger inside the pagination controls) and choose a
 * different value than the current one. Scoped to the pagination container +
 * first VISIBLE combobox so the mobile/desktop duplicates don't trip strict
 * mode. Skips cleanly if there's no selector or only one option.
 */
async function exercisePageSize(page: Page, beat: number): Promise<void> {
  const controls = page.getByLabel("pagination controls").first();
  if (!(await present(controls))) return;

  const trigger = controls.getByRole("combobox").filter({ visible: true }).first();
  if (!(await visible(trigger))) return;

  const current = (await trigger.textContent().catch(() => ""))?.trim() ?? "";

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(beat);

  // Options are SelectItems (role "option") in a portal popover. Pick the first
  // option whose label differs from the current value so the page size visibly
  // changes. If every option equals current (single option), close + bail.
  const options = page.getByRole("option");
  const count = await options.count().catch(() => 0);
  let picked = false;
  for (let i = 0; i < count; i++) {
    const opt = options.nth(i);
    const label = (await opt.textContent().catch(() => ""))?.trim() ?? "";
    if (label && label !== current) {
      await opt.click({ timeout: 10_000 }).catch(() => undefined);
      picked = true;
      break;
    }
  }
  if (!picked) {
    await page.keyboard.press("Escape").catch(() => undefined);
    return;
  }
  await settle(page, beat);
}
