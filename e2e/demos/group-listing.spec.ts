import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "group-listing";

// # coverage: tours the grouped-runs LISTING surface at /analytics/pricing —
// distinct from group-overview by focusing the table itself: scroll rows, hover,
// type-and-clear the row search, open-and-Escape a sortable column header, the
// column View-options menu, the rows-per-page selector, and the toolbar date
// range. Every beat past the one page-ready assertion is guarded (isVisible
// guard / hoverLocatorIfVisible / open-then-Escape) so it no-ops if absent, and
// nothing commits a destructive or mutating change.

test.describe("demo: group listing", () => {
  test("tours the grouped model-run listing table and its controls", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);

    // Single page-ready assertion: the runs/groups table is mounted.
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    // Settle out the loading skeleton so no shimmer frame is recorded.
    await settleLoaded(page);

    // --- Tour the page top -> bottom: summary cards + spend chart, then table.
    await scrollToText(page, /total|spend|cost|tokens|runs/i);
    await pauseForDemo();
    await scrollToText(page, /created|profile|agents|models/i);
    await pauseForDemo();

    // --- Hover the first data row so the listing reads as live tabular data.
    const firstRow = page.locator('[data-testid="pricing-runs-table"] tbody tr').first();
    await hoverLocatorIfVisible(firstRow);

    // --- Hover a per-row "View" link (do NOT click — that leaves the listing).
    await hoverLocatorIfVisible(
      page.getByRole("link", { name: /^view$/i }).first(),
    );

    // --- Row search: type so the keystrokes show, let it react, then clear.
    const search = page.getByPlaceholder("Search by model, agent, name, debug info...");
    if (await search.isVisible().catch(() => false)) {
      await search.click();
      await search.pressSequentially("agent", { delay: 55 });
      await pauseForDemo(1_100); // debounced re-query settles
      await settleLoaded(page);
      await search.fill("");
      await pauseForDemo(900);
      await settleLoaded(page);
    }

    // --- Sortable column header: open its sort menu, reveal Asc/Desc, Escape
    // WITHOUT committing a sort (read-only reveal of the affordance).
    const sortHeader = page.getByRole("button", { name: /cost/i }).first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.click();
      await pauseForDemo(900);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // --- Column View-options menu: open, reveal toggles, Escape.
    // The per-row "View" cells are links; the column-options control is a
    // button — scope to role=button so we open the right one.
    const viewOptions = page.getByRole("button", { name: /^view$/i }).first();
    if (await viewOptions.isVisible().catch(() => false)) {
      await viewOptions.click();
      await pauseForDemo(900);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // --- Rows-per-page selector: open the listbox, reveal options, Escape.
    const pageSize = page.getByRole("combobox").first();
    if (await pageSize.isVisible().catch(() => false)) {
      await pageSize.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSize.click();
      await pauseForDemo(900);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // --- Toolbar date-range picker: open the calendar, hold, Escape without
    // committing a range (no re-query is triggered).
    const dateRange = page.locator("#date").first();
    if (await dateRange.isVisible().catch(() => false)) {
      await dateRange.click();
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});
