// coverage: SEARCH-LED full-page tour of the Models library. The centerpiece
// is the page search: read a REAL model card's name off the loaded grid, type
// its leading token (pressSequentially so the keystrokes show) into the
// `models-search` box, let the debounced query (500ms) narrow the grid, hold
// so the filtered result reads, then clear it back to the full library. After
// the search beat, a brief NON-DESTRUCTIVE tour: scroll the grid, open EACH
// faceted filter (Provider / Agent / Department) + the View menu and Escape
// them, then page Next->Prev. Every beat past the one page-ready assertion (the
// loaded `models-grid`) is GUARDED so it no-ops when its target is absent, and
// nothing mutates (open-then-Escape / read-only only — no delete/duplicate).
import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const BEAT = 950;

/** True when the first match is attached AND visible. Never throws. */
async function visible(locator: import("@playwright/test").Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

test.describe("demo: models search", () => {
  test("search the models library", async ({ page }) => {
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

    // ---- 1. CENTERPIECE: type a REAL matching model term, narrow, clear ----
    // Read the first card's accessible name (`model card {name}`) so the term
    // we type is guaranteed to match at least that one card — the grid visibly
    // narrows instead of going empty. Fall back to a benign letter if the name
    // can't be read so the beat still demonstrates live re-querying.
    const search = page.getByTestId("models-search").filter({ visible: true }).first();
    if (await visible(search)) {
      const firstCard = page.getByTestId("model-card").filter({ visible: true }).first();
      let term = "a";
      if (await visible(firstCard)) {
        const label = (await firstCard.getAttribute("aria-label").catch(() => "")) ?? "";
        // aria-label is "model card {name}". Take the leading token of {name}.
        const name = label.replace(/^model card\s+/i, "").trim();
        const token = name.split(/\s+/)[0] ?? "";
        if (token && !/^(generating|unnamed)$/i.test(token)) term = token;
      }
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("");
      // Typed key-by-key so the search term appears on camera; the input is
      // debounced (~500ms) so let it settle before the grid re-renders.
      await search.pressSequentially(term, { delay: 55 });
      await pauseForDemo(700);
      await waitOutSkeleton(page);
      // Hold on the narrowed grid so the filtered result reads.
      await pauseForDemo(BEAT);
      await pauseForDemo(BEAT);
      // Clear back to the full library.
      await search.fill("");
      await pauseForDemo(700);
      await waitOutSkeleton(page);
      await pauseForDemo(BEAT);
    }

    // ---- 2. Scroll the grid so the restored full library reads ----
    const cards = page.getByTestId("model-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 0) {
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
      if (cardCount > 2) {
        await cards
          .nth(Math.floor(cardCount / 2))
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
        await pauseForDemo(BEAT);
      }
      await cards.last().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
      await cards.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(BEAT);
    }

    // ---- 3. Open EACH faceted filter, reveal options, dismiss (Escape) ----
    // Provider / Agent / Department are FacetedFilter buttons whose accessible
    // name is the slot title. Opening reveals the option list; we never pick a
    // value (read-only tour) — just Escape.
    for (const title of ["Provider", "Agent", "Department"] as const) {
      const trigger = page
        .getByRole("button", { name: new RegExp(`^${title}$`) })
        .first();
      if (!(await visible(trigger))) continue;
      await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await trigger.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(BEAT);
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

    await saveDemoVideo(page, "models-search");
  });
});
