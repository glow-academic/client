import { expect, test, type Locator, type Page } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-history";

// coverage: tour the learner-home attempt-HISTORY section lower on /home — the
// past-attempts table (date / simulation / scenarios / score rows). Scroll to
// it, hover rows, type+clear its search, open each faceted view-filter (Name /
// Simulation / Scenarios / Mode), a column-header sort menu, the column View
// menu, and the Rows-per-page select — every one open-then-Escape, never
// committing a filter and never starting a simulation. Distinct from
// home-overview (launch deck) and home-assigned (progress cards).

/** Open a popover/dropdown trigger by its visible text, hold, then Escape. */
async function openByTextThenEscape(trigger: Locator, page: Page): Promise<void> {
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
    await trigger.click().catch(() => undefined);
    await pauseForDemo(900);
    await page.keyboard.press("Escape").catch(() => undefined);
    await pauseForDemo(400);
  }
}

test.describe("demo: home attempt history", () => {
  test("records the attempt-history table, search, filters, and sort", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);

    // ONE page-ready assertion. Everything past here is guarded / no-ops when absent.
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // Trim the skeleton lead-in so the captured frames are the loaded page.
    await settleLoaded(page);

    // Scroll down past the launch deck to the history section. Its column
    // headers / pagination anchor the lower table.
    await scrollToText(page, /search by name, simulation, or scenarios/i);
    await scrollToText(page, /rows per page/i);

    // Type into the history search so the search field visibly reacts, then
    // clear it (read-only re-query — non-mutating). pressSequentially makes the
    // typing show on frame.
    const historySearch = page
      .getByPlaceholder("Search by name, simulation, or scenarios...")
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click().catch(() => undefined);
      await historySearch.pressSequentially("office", { delay: 55 });
      await pauseForDemo(1_100);
      await historySearch.fill("");
      await pauseForDemo(800);
    }

    // Hover a couple of history rows so the row-level detail (date, score
    // badge, scenarios, persona dots) reads on frame.
    const historyRows = page.locator("table tbody tr");
    const rowCount = await historyRows.count().catch(() => 0);
    for (const i of [0, 1, 2]) {
      if (i >= rowCount) break;
      const row = historyRows.nth(i);
      if (await row.isVisible().catch(() => false)) {
        await row.scrollIntoViewIfNeeded().catch(() => undefined);
        await row.hover().catch(() => undefined);
        await pauseForDemo(600);
      }
    }

    // Open each faceted view-filter trigger in turn, reveal its options, then
    // Escape WITHOUT selecting (selecting would re-query/commit a filter).
    for (const title of ["Name", "Simulation", "Scenarios", "Mode"]) {
      await openByTextThenEscape(
        page.getByRole("button", { name: title, exact: true }).first(),
        page,
      );
    }

    // Open a column-header sort menu (Date / Score) to reveal Asc / Desc /
    // Clear / Hide, then Escape without choosing one.
    for (const header of ["Score", "Date"]) {
      await openByTextThenEscape(
        page.getByRole("button", { name: header, exact: true }).first(),
        page,
      );
    }

    // Open the column View (toggle-columns) menu, reveal it, Escape.
    await openByTextThenEscape(page.getByRole("button", { name: "View" }).first(), page);

    // Open the Rows-per-page select, reveal the page-size options, Escape.
    await openByTextThenEscape(page.getByRole("combobox").last(), page);

    // Settle one final beat on the loaded history table.
    await scrollToText(page, /rows per page/i);
    await pauseForDemo(700);

    await saveDemoVideo(page, TOPIC);
  });
});
