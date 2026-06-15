import { test } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-results-comparison";

// # coverage: tour the benchmark page with the emphasis on COMPARING run
// results — the eval-history table's comparison columns. After a quick pass
// over the eval catalog carousel and the analytics toolbar (date-range
// picker), we settle on the results-history table and exercise its
// comparison affordances: type into the search to narrow the set of runs,
// open every per-column faceted filter (Eval / Model / Profile / Rubric) to
// show runs can be sliced by each dimension, open the sortable column-header
// menus (Score, Models, Date) that re-rank the comparison, open the column
// "View" options to add/remove comparison columns, and step the pagination.
// Every beat past the one page-ready assertion is guarded (no-op if its
// target is absent) and strictly non-destructive: open->Escape every menu,
// type-then-clear the search, never commit a sort/filter/archive. End held on
// the populated comparison table.

test.describe("demo: benchmark results comparison", () => {
  test("compares run results across the history table's sortable, filterable columns", async ({
    page,
  }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the loaded eval grid is on screen.
    await expectBenchmarkGridVisible(page);

    // Open on the populated grid (skeleton waited out + a settle beat).
    await settleLoaded(page);

    // ---- Beat 1 — a quick orienting glance at the eval catalog carousel so
    // the viewer knows WHICH evals the results below belong to. ------------
    const firstCard = page.getByTestId(/^eval-card-/).first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstCard.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // ---- Beat 2 — the analytics toolbar: open the date-range picker (its
    // trigger is `#date`) to show results can be scoped to a window, then
    // Escape WITHOUT picking a range (no query mutation). ------------------
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // ---- Beat 3 — pan down to the results-history comparison table and let
    // the comparison columns (Date / Eval / Models / Score) read. ----------
    await scrollToText(page, /^Score$/);
    await scrollToText(page, /No tests found\.|^Models$|^Eval$/i);
    await pauseForDemo(1_100);

    // ---- Beat 4 — narrow the set of runs being compared: type into the
    // search so the table reacts, hold, then clear it (leaves view as found).
    const search = page
      .getByPlaceholder("Search by name, eval, or models...")
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await pauseForDemo(400);
      await search.pressSequentially("eval", { delay: 55 });
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(700);
    }

    // ---- Beat 5 — slice the comparison by each dimension: open every
    // per-column faceted filter (Eval / Model / Profile / Rubric) to reveal
    // its option list, then Escape WITHOUT toggling (no filter committed). --
    for (const facet of ["Eval", "Model", "Profile", "Rubric"]) {
      const facetBtn = page
        .getByRole("button", { name: new RegExp(`^${facet}$`) })
        .first();
      if (await facetBtn.isVisible().catch(() => false)) {
        await facetBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        await facetBtn.click().catch(() => undefined);
        await pauseForDemo(950);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(450);
      }
    }

    // ---- Beat 6 — the heart of a comparison: re-rank by a column. Each
    // sortable header (Score / Models / Date) is a button whose menu offers
    // Asc / Desc / Hide. Open each to show the comparison is reorderable,
    // then Escape WITHOUT choosing (no sort committed, no URL change). ------
    for (const colTitle of ["Score", "Models", "Date"]) {
      const header = page
        .getByRole("button", { name: new RegExp(`^${colTitle}$`) })
        .first();
      if (await header.isVisible().catch(() => false)) {
        await header.scrollIntoViewIfNeeded().catch(() => undefined);
        await header.click().catch(() => undefined);
        await pauseForDemo(950);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(450);
      }
    }

    // ---- Beat 7 — open the column "View" options dropdown to show which
    // comparison columns can be shown/hidden, then dismiss (none toggled). --
    const viewOptions = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewOptions.isVisible().catch(() => false)) {
      await viewOptions.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewOptions.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // ---- Beat 8 — open the rows-per-page selector to show how many runs are
    // compared per page, reveal the options, then dismiss. -----------------
    const rowsLabel = page.getByText(/Rows per page/i).first();
    if (await rowsLabel.isVisible().catch(() => false)) {
      await rowsLabel.scrollIntoViewIfNeeded().catch(() => undefined);
      const pageSizeTrigger = page.getByRole("combobox").last();
      if (await pageSizeTrigger.isVisible().catch(() => false)) {
        await pageSizeTrigger.click().catch(() => undefined);
        await pauseForDemo(1_000);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    // ---- Final hold — end on the populated comparison table. --------------
    await scrollToText(page, /^Score$/);
    await pauseForDemo(1_200);

    await saveDemoVideo(page, TOPIC);
  });
});
