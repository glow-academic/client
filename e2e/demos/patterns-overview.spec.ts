import { expect, test, type Page } from "@playwright/test";

import { expectAuthenticated, settleLoaded, scrollToText, hoverFirstVisible } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-overview";

// coverage: tour the two data-rich pattern catalogs (personas + rubrics)
// top->bottom, exercising each catalog's real affordances — search box,
// faceted filter pickers, and pagination — all non-destructively
// (open-then-Escape, reset after) and all guarded so each beat no-ops when
// its target is absent. The simulations catalog is intentionally dropped (its
// cards are sparse "No description" stubs). After each page.goto we HARD-gate
// on the grid being visible AND the skeleton being detached BEFORE any hold,
// so no loading-skeleton frame is ever filmed at the catalog transition.

interface Catalog {
  path: string;
  toolbar: string;
  grid: string;
  search: string;
  card: string;
  query: string;
  /** Faceted-filter button titles to open->reveal->Escape, in order. */
  filters: string[];
}

const CATALOGS: Catalog[] = [
  {
    path: "/training/personas",
    toolbar: "personas-toolbar",
    grid: "personas-grid",
    search: "personas-search",
    card: "persona-card",
    query: "student",
    filters: ["Scenario", "Field", "Department"],
  },
  {
    path: "/platform/rubrics",
    toolbar: "rubrics-toolbar",
    grid: "rubrics-grid",
    search: "rubrics-search",
    card: "rubric-card",
    query: "standard",
    filters: ["Simulation", "Department"],
  },
];

/**
 * HARD skeleton gate: wait for the catalog grid to be visible (page ready),
 * then wait for the loading shimmer to detach, THEN settle. Run BEFORE any
 * hold so the catalog transition never records a skeleton frame.
 */
async function gateCatalogReady(page: Page, c: Catalog): Promise<void> {
  await expect(page.getByTestId(c.grid).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
  await page
    .getByTestId("skeleton")
    .first()
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => undefined);
  await settleLoaded(page);
}

/** Type into the catalog search so the typing shows, let it re-query, clear it. */
async function exerciseSearch(page: Page, c: Catalog): Promise<void> {
  const input = page.getByTestId(c.search).first();
  if (!(await input.isVisible().catch(() => false))) return;
  await input.scrollIntoViewIfNeeded().catch(() => undefined);
  await input.click().catch(() => undefined);
  await input.pressSequentially(c.query, { delay: 55 }).catch(() => undefined);
  await pauseForDemo(1_100);
  // Let the server re-query settle before reading the filtered grid.
  await page
    .getByTestId("skeleton")
    .first()
    .waitFor({ state: "detached", timeout: 8_000 })
    .catch(() => undefined);
  await pauseForDemo(900);
  // Reset — non-destructive, restores the full catalog.
  await input.fill("").catch(() => undefined);
  await input.press("Enter").catch(() => undefined);
  await pauseForDemo(900);
}

/** Open each faceted filter popover, reveal its options, dismiss with Escape. */
async function exerciseFilters(page: Page, c: Catalog): Promise<void> {
  for (const title of c.filters) {
    const trigger = page.getByRole("button", { name: title, exact: true }).first();
    if (!(await trigger.isVisible().catch(() => false))) continue;
    await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
    await trigger.click().catch(() => undefined);
    await pauseForDemo(950);
    // Dismiss without committing any selection (non-destructive).
    await page.keyboard.press("Escape").catch(() => undefined);
    await pauseForDemo(450);
  }
}

/** Click next-page then back, if pagination is enabled (guarded, reversible). */
async function exercisePagination(page: Page): Promise<void> {
  const next = page.getByRole("button", { name: "Go to next page" }).first();
  if (!(await next.isVisible().catch(() => false))) return;
  if (await next.isDisabled().catch(() => true)) return;
  await next.scrollIntoViewIfNeeded().catch(() => undefined);
  await next.click().catch(() => undefined);
  await page
    .getByTestId("skeleton")
    .first()
    .waitFor({ state: "detached", timeout: 8_000 })
    .catch(() => undefined);
  await pauseForDemo(1_000);
  // Return to page one so the catalog is left as found.
  const prev = page.getByRole("button", { name: "Go to previous page" }).first();
  if (await prev.isVisible().catch(() => false)) {
    await prev.click().catch(() => undefined);
    await pauseForDemo(900);
  }
}

test.describe("demo: patterns overview", () => {
  test("tour the persona and rubric pattern catalogs", async ({ page }) => {
    test.setTimeout(180_000);

    for (const c of CATALOGS) {
      await page.goto(c.path);
      await expectAuthenticated(page);
      // HARD gate BEFORE any hold — no skeleton frame at the transition.
      await gateCatalogReady(page, c);

      // Scroll the catalog top->bottom, holding on the populated grid.
      await scrollToText(page, /filter|department|scenario|simulation|persona|rubric|voice|standard/i);
      await hoverFirstVisible(page, c.card);

      // Exercise the catalog's affordances, all non-destructive.
      await exerciseSearch(page, c);
      await exerciseFilters(page, c);
      await exercisePagination(page);

      // Settle back on the loaded grid before the next catalog.
      await hoverFirstVisible(page, c.card);
      await pauseForDemo(800);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
