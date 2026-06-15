import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: a SEARCH-LED tour of the Tools library (distinct from tools-overview,
// which is a top->bottom affordance sweep). The centerpiece is TYPING A REAL
// MATCHING term derived from a live card name, character-by-character so the
// query shows on camera, watching the grid visibly NARROW, holding so the
// filtered result reads, then CLEARING back to the full library. After the
// search beat it adds a brief, GUARDED filter + pagination tour: open each of
// the three faceted pickers (Permissions / Agent / Department) revealing options
// then Escaping WITHOUT committing, and page Next/Prev. Every beat past the one
// page-ready assertion is GUARDED (isVisible().catch(()=>false) / enabled checks)
// so a control the page lacks is skipped, not failed. Strictly NON-DESTRUCTIVE:
// type-then-clear and open-then-Escape only — never confirm a mutating change.

const TOPIC = "tools-search";

/** True when the first match of a locator is visible. Never throws. */
async function shown(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Derive a SELECTIVE, REAL search term from the first visible tool card so the
 * search beat narrows the grid to actual matching data (not a near-universal
 * letter). Every card carries `aria-label="tool card {name}"`, so we read that,
 * strip the "tool card " prefix, and take the first word of the real name.
 *
 * Fully guarded: returns null on any miss (no card, unreadable label, ghost
 * "Generating"/"Unnamed" placeholder, sub-2-char word) so the caller falls back
 * to a safe default. Never throws.
 */
async function deriveTerm(page: Page): Promise<string | null> {
  const card = page.locator('[aria-label^="tool card "]').first();
  if (!(await shown(card))) return null;
  const label = (await card.getAttribute("aria-label").catch(() => null)) ?? "";
  const name = label.replace(/^tool card\s+/i, "").trim();
  if (!name || /^(Generating|Unnamed\b)/i.test(name)) return null;
  const word = (name.split(/\s+/)[0] ?? "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return word.trim().length >= 2 ? word.trim() : null;
}

/** Open a faceted filter popover by its trigger label, hold so the option list
 *  reads on camera, then Escape WITHOUT committing any option. Guarded: skips
 *  cleanly if the trigger isn't present. */
async function previewFilter(page: Page, label: string): Promise<void> {
  const trigger = page.getByRole("button", { name: new RegExp(`^${label}$`) }).first();
  if (!(await shown(trigger))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);
  // Hold on the revealed option list (CommandItems, role "option").
  await pauseForDemo(900);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(500);
}

test.describe("demo: tools search", () => {
  test("search the tools library", async ({ page }) => {
    // 1) Land on the Tools index, prove we're authed, and wait the loading
    //    skeleton out so the opening frames are the populated grid (the one
    //    page-ready assertion every later beat is allowed to depend on).
    await page.goto("/intelligence/tools");
    await expectAuthenticated(page);
    await expect(page.getByTestId("tools-grid")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // 2) Brief context: hover the first card so the grid reads as a real,
    //    populated library before we filter it.
    await hoverFirstVisible(page, "tool-card");

    // 3) SEARCH (the centerpiece) — derive a REAL term from a visible card,
    //    type it character-by-character so the query shows on camera, let the
    //    grid re-query and visibly narrow, HOLD so the filtered result reads,
    //    then clear it back to the full library. Guarded: if the search box is
    //    absent the whole beat no-ops.
    const search = page.getByTestId("tools-search");
    if (await shown(search)) {
      const term = (await deriveTerm(page).catch(() => null)) ?? "tool";
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("");
      await search.pressSequentially(term, { delay: 55 });
      await search.press("Enter");
      // The grid re-fetches on the committed query — wait the resulting shimmer
      // out so the camera lands on the NARROWED result, not a loading frame.
      await settleLoaded(page);
      // Hold so the filtered grid reads, and confirm the search produced a
      // matching card (non-destructive, just a visibility check on camera).
      if (await shown(page.getByTestId("tool-card"))) {
        await page.getByTestId("tool-card").first().scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(1_200);
      }
      // Clear back to the full library so the later tour runs unfiltered.
      await search.fill("");
      await search.press("Enter");
      await settleLoaded(page);
    }

    // 4) FILTERS — a brief tour: open each of the three faceted pickers in turn,
    //    reveal its options, and Escape WITHOUT committing (read-only preview,
    //    no mutation to the URL/grid). Each is guarded to a no-op if absent.
    await previewFilter(page, "Permissions");
    await previewFilter(page, "Agent");
    await previewFilter(page, "Department");

    // 5) PAGINATION — advance to the next page (if there is one), hold on the
    //    advanced grid, then go back. The arrows carry sr-only names and render
    //    twice (mobile + desktop), so target the first VISIBLE match.
    const next = page.getByRole("button", { name: /next page/i }).filter({ visible: true }).first();
    if ((await shown(next)) && (await next.isEnabled().catch(() => false))) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click({ timeout: 10_000 }).catch(() => undefined);
      await settleLoaded(page);
      const prev = page
        .getByRole("button", { name: /previous page/i })
        .filter({ visible: true })
        .first();
      if ((await shown(prev)) && (await prev.isEnabled().catch(() => false))) {
        await prev.click({ timeout: 10_000 }).catch(() => undefined);
        await settleLoaded(page);
      }
    }

    await saveDemoVideo(page, TOPIC);
  });
});
