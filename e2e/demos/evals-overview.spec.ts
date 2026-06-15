import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-overview";

/**
 * coverage: a full-page tour of the Evals library (read-only, superadmin).
 *
 * Beats, each independently guarded (every locator past the one page-ready
 * assertion no-ops when its target is absent), all NON-DESTRUCTIVE
 * (open-then-Escape / toggle-then-restore — nothing is confirmed, deleted, or
 * persisted):
 *   1. land + settle the grid (no skeleton frame).
 *   2. tour the card grid top->bottom (hover the first card, scroll a couple
 *      cards into view) so the populated library reads on camera.
 *   3. type into the `evals-search` box (character-by-character) so the grid
 *      visibly narrows, then clear it back.
 *   4. open each faceted filter (Model / Rubric / Department), reveal its
 *      options, and Escape WITHOUT committing.
 *   5. open the "View" column-visibility menu, toggle the first card feature
 *      off, pause, toggle it back on, close.
 *   6. open the "Import CSV" dialog (if present), hold so it reads, Escape.
 *   7. select the first card to reveal the bulk-action toolbar, hold, then
 *      "Unselect All" to restore the default toolbar (no bulk op committed).
 *   8. paginate Next -> Prev (if multi-page), each settled on the advanced grid.
 *   9. open the page-size selector and choose a different value.
 *
 * The single hard assertion is the `evals-grid` container, so a broken page
 * still fails loudly; every other beat degrades to a clean no-op.
 */
test.describe("demo: evals overview", () => {
  test("tours the evals library and its affordances", async ({ page }) => {
    await page.goto("/platform/evals");
    await expectAuthenticated(page);
    await expect(page.getByTestId("evals-grid")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Beat 2: tour the populated card grid — hover the first card, then scroll a
    // couple more into view so the whole library is surveyed top->bottom.
    const cards = page.getByTestId("eval-card");
    if (await cards.first().isVisible().catch(() => false)) {
      await cards.first().hover().catch(() => undefined);
      await pauseForDemo(1_000);
      const count = await cards.count().catch(() => 0);
      for (const i of [2, 4]) {
        if (i < count) {
          await cards.nth(i).scrollIntoViewIfNeeded().catch(() => undefined);
          await pauseForDemo(900);
        }
      }
      // Back to the top of the grid before driving the toolbar affordances.
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
    }

    // Beat 3: type into the search box so the grid narrows on camera, then clear.
    const search = page.getByTestId("evals-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.click().catch(() => undefined);
      await search.pressSequentially("eval", { delay: 55 });
      // Search debounces (~500ms) then commits to the URL → re-fetch.
      await pauseForDemo(900);
      await waitOutSkeleton(page);
      await pauseForDemo(1_100);
      // Clear back to the full library for the remaining beats.
      await search.fill("");
      await pauseForDemo(900);
      await waitOutSkeleton(page);
      await pauseForDemo(700);
    }

    // Beat 4: open each faceted filter, reveal options, Escape (no commit).
    for (const title of ["Model", "Rubric", "Department"] as const) {
      const trigger = page.getByRole("button", { name: title, exact: true }).first();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click().catch(() => undefined);
        await pauseForDemo(1_300);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(600);
      }
    }

    // Beat 5: open the "View" column-visibility menu, toggle a card feature
    // off then back on (reversible), close.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_100);
      const item = page.getByRole("menuitemcheckbox").first();
      if (await item.isVisible().catch(() => false)) {
        await item.click().catch(() => undefined);
        await pauseForDemo(1_000);
        // Radix keeps the menu open after a checkbox toggle; restore the feature.
        if (await item.isVisible().catch(() => false)) {
          await item.click().catch(() => undefined);
          await pauseForDemo(900);
        }
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 6: open the Import CSV dialog (if present), hold, Escape (no import).
    const importBtn = page.getByRole("button", { name: /import csv/i }).first();
    if (await importBtn.isVisible().catch(() => false)) {
      await importBtn.click().catch(() => undefined);
      await pauseForDemo(1_500);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // Beat 7: select the first card to reveal the bulk-action toolbar, hold so
    // the Delete/Edit actions read, then Unselect All (nothing committed).
    if (await cards.first().isVisible().catch(() => false)) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await cards.first().click().catch(() => undefined);
      await pauseForDemo(1_400);
      const unselect = page.getByRole("button", { name: /unselect all/i }).first();
      if (await unselect.isVisible().catch(() => false)) {
        await unselect.click().catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // Beat 8: paginate Next -> Prev when there's more than one page.
    const next = page
      .getByRole("button", { name: /next page/i })
      .filter({ visible: true })
      .first();
    if (
      (await next.isVisible().catch(() => false)) &&
      (await next.isEnabled().catch(() => false))
    ) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click().catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(1_200);
      const prev = page
        .getByRole("button", { name: /previous page/i })
        .filter({ visible: true })
        .first();
      if (
        (await prev.isVisible().catch(() => false)) &&
        (await prev.isEnabled().catch(() => false))
      ) {
        await prev.click().catch(() => undefined);
        await waitOutSkeleton(page);
        await pauseForDemo(1_000);
      }
    }

    // Beat 9: open the page-size selector and pick a different value.
    const sizeTrigger = page.getByRole("combobox").filter({ visible: true }).first();
    if (await sizeTrigger.isVisible().catch(() => false)) {
      const current = (await sizeTrigger.textContent().catch(() => ""))?.trim() ?? "";
      await sizeTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await sizeTrigger.click().catch(() => undefined);
      await pauseForDemo(1_000);
      const options = page.getByRole("option");
      const optCount = await options.count().catch(() => 0);
      let picked = false;
      for (let i = 0; i < optCount; i++) {
        const opt = options.nth(i);
        const label = (await opt.textContent().catch(() => ""))?.trim() ?? "";
        if (label && label !== current) {
          await opt.click().catch(() => undefined);
          picked = true;
          break;
        }
      }
      if (!picked) {
        await page.keyboard.press("Escape").catch(() => undefined);
      }
      await waitOutSkeleton(page);
      await pauseForDemo(1_100);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
