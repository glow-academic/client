import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: a full top->bottom tour of the Tools library index — scroll the
// card grid, type-and-clear the search box, open EACH of the three faceted
// filters (Permissions / Agent / Department) revealing options then Escaping
// WITHOUT committing, open the View column-visibility menu, open the Import-CSV
// modal and dismiss it, then page Next/Prev. Every beat past the one page-ready
// assertion is GUARDED (isVisible().catch(()=>false) / enabled checks) so a
// control the page lacks is skipped, not failed. Strictly NON-DESTRUCTIVE:
// open-then-Escape only, never confirm a delete / import / mutating change.

const TOPIC = "tools-overview";

/** True when the first match of a locator is visible. Never throws. */
async function shown(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
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

test.describe("demo: tools overview", () => {
  test("tour the tools library", async ({ page }) => {
    // 1) Land on the Tools index, prove we're authed, and wait the loading
    //    skeleton out so the opening frames are the populated grid (the one
    //    page-ready assertion every later beat is allowed to depend on).
    await page.goto("/intelligence/tools");
    await expectAuthenticated(page);
    await expect(page.getByTestId("tools-grid")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // 2) Tour the grid top->bottom: hover the first card, scroll the grid into
    //    view, hold on the populated library.
    await hoverFirstVisible(page, "tool-card");
    const grid = page.getByTestId("tools-grid");
    if (await shown(grid)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // 3) SEARCH — type a term character-by-character so it shows on camera,
    //    let the grid re-query, then clear it back to the full library.
    const search = page.getByTestId("tools-search");
    if (await shown(search)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("");
      await search.pressSequentially("search", { delay: 55 });
      await search.press("Enter");
      await settleLoaded(page);
      await search.fill("");
      await search.press("Enter");
      await settleLoaded(page);
    }

    // 4) FILTERS — open each of the three faceted pickers in turn, reveal its
    //    options, and Escape WITHOUT committing (read-only preview, no mutation
    //    to the URL/grid). Each is guarded to a no-op if absent.
    await previewFilter(page, "Permissions");
    await previewFilter(page, "Agent");
    await previewFilter(page, "Department");

    // 5) VIEW — open the column-visibility menu so its card-feature toggles
    //    read, then close. Don't toggle anything (keeps the grid as-is).
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await shown(viewBtn)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(900);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // 6) IMPORT-CSV MODAL — open the bulk-import dialog so its content reads,
    //    hold, then Escape. NON-DESTRUCTIVE: we never pick a file or confirm.
    const importBtn = page.getByRole("button", { name: /import csv/i }).first();
    if (await shown(importBtn)) {
      await importBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await importBtn.click({ timeout: 10_000 }).catch(() => undefined);
      const dialog = page.getByTestId("dialog-bulk-import");
      if (await shown(dialog)) {
        await pauseForDemo(1_200);
        await page.keyboard.press("Escape").catch(() => undefined);
        await settleLoaded(page);
      }
    }

    // 7) PAGINATION — advance to the next page (if there is one), hold on the
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
