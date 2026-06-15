// coverage: full-page tour of the Models library — scroll the toolbar + card
// grid top->bottom, type+clear the page search, open EACH faceted filter
// (Provider / Agent / Department) and the View (column-visibility) menu and
// dismiss them, page through the grid + page-size selector, then open a single
// model's read-only detail page and return. Every beat past the one page-ready
// assertion (the loaded `models-grid`) is GUARDED so it no-ops when its target
// is absent, and NON-DESTRUCTIVE (open-then-Escape / read-only link only — no
// delete/duplicate/submit).
import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, settleLoaded, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const BEAT = 950;

/** True when the first match is attached AND visible. Never throws. */
async function visible(locator: import("@playwright/test").Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

test.describe("demo: models overview", () => {
  test("tour the models library", async ({ page }) => {
    test.setTimeout(120_000);

    // ---- Page ready: land on the loaded grid (the one hard assertion) ----
    await page.goto("/intelligence/models");
    await expectAuthenticated(page);
    // Wait the loading shimmer out BEFORE the first beat so no skeleton frame
    // is recorded, then assert the loaded grid (visible-scoped to dodge a
    // lingering hidden dev-mode duplicate of the route subtree).
    await waitOutSkeleton(page);
    const grid = page.getByTestId("models-grid").filter({ visible: true }).first();
    await expect(grid).toBeVisible({ timeout: 30_000 });

    // ---- 1. Scroll the toolbar + grid top -> bottom ----
    const toolbar = page.getByTestId("models-toolbar").first();
    if (await visible(toolbar)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
    }
    const cards = page.getByTestId("model-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 0) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
      // Hold on a card mid-grid, then the last, so the whole grid reads.
      if (cardCount > 2) {
        await cards.nth(Math.floor(cardCount / 2)).scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(BEAT);
      }
      await cards.last().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
    }

    // ---- 2. Type into the page search, let it re-query, then clear ----
    const search = page.getByTestId("models-search").first();
    if (await visible(search)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("");
      await search.pressSequentially("a", { delay: 55 });
      await waitOutSkeleton(page);
      await pauseForDemo(BEAT);
      await search.fill("");
      await search.press("Enter").catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(BEAT);
    }

    // ---- 3. Open EACH faceted filter, reveal options, dismiss (Escape) ----
    // The Provider / Agent / Department triggers are FacetedFilter buttons
    // whose accessible name is the slot title. Opening reveals the option
    // CommandList; we never pick a value (read-only tour) — just Escape.
    for (const title of ["Provider", "Agent", "Department"] as const) {
      const trigger = page
        .getByRole("button", { name: new RegExp(`^${title}$`) })
        .first();
      if (!(await visible(trigger))) continue;
      await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await trigger.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(BEAT);
      // Let any option row paint so the popover reads on camera.
      const option = page.getByRole("option").first();
      if (await visible(option)) await pauseForDemo(BEAT);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(400);
    }

    // ---- 4. Open the View (column-visibility) menu, reveal, dismiss ----
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await visible(viewBtn)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(BEAT);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(400);
    }

    // ---- 5. Paginate: Next -> settle -> Prev (only if a next page exists) ----
    const next = page
      .getByRole("button", { name: /next page/i })
      .filter({ visible: true })
      .first();
    if ((await visible(next)) && (await next.isEnabled().catch(() => false))) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click({ timeout: 10_000 }).catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(BEAT);
      const prev = page
        .getByRole("button", { name: /previous page/i })
        .filter({ visible: true })
        .first();
      if ((await visible(prev)) && (await prev.isEnabled().catch(() => false))) {
        await prev.click({ timeout: 10_000 }).catch(() => undefined);
        await waitOutSkeleton(page);
        await pauseForDemo(BEAT);
      }
    }

    // ---- 6. Open the page-size selector, reveal options, pick a new size ----
    const controls = page.getByLabel("pagination controls").first();
    if (await visible(controls.getByRole("combobox").filter({ visible: true }).first())) {
      const sizeTrigger = controls.getByRole("combobox").filter({ visible: true }).first();
      const current = (await sizeTrigger.textContent().catch(() => ""))?.trim() ?? "";
      await sizeTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await sizeTrigger.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(BEAT);
      const opts = page.getByRole("option");
      const n = await opts.count().catch(() => 0);
      let picked = false;
      for (let i = 0; i < n; i++) {
        const label = (await opts.nth(i).textContent().catch(() => ""))?.trim() ?? "";
        if (label && label !== current) {
          await opts.nth(i).click({ timeout: 10_000 }).catch(() => undefined);
          picked = true;
          break;
        }
      }
      if (!picked) await page.keyboard.press("Escape").catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(BEAT);
    }

    // ---- 7. Open ONE model's read-only detail page, hold, then return ----
    // `btn-view-model` is a link to /intelligence/models/{id} (read-only — no
    // mutation). Settle the detail page out of its skeleton, hold so the
    // content reads, then go back to the library.
    const viewCard = page.getByTestId("btn-view-model").filter({ visible: true }).first();
    if (await visible(viewCard)) {
      await viewCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewCard.click({ timeout: 10_000 }).catch(() => undefined);
      await settleLoaded(page);
      await pauseForDemo(BEAT);
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(BEAT);
    }

    await saveDemoVideo(page, "models-overview");
  });
});
