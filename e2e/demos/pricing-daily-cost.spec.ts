import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-daily-cost";

// coverage: tour the WHOLE pricing analytics page top->bottom — summary cards
// (total spend / run count / avg cost), the daily spend-over-time chart, the
// toolbar date-range picker, then the runs table's search box, column-view
// options, rows-per-page selector, sortable headers and per-row View link.
// Every beat past the ONE page-ready assertion no-ops if its target is absent,
// and every popover/dropdown is opened-then-Escaped (non-destructive, no
// requery committed) so nothing mutates this LIVE instance.

test.describe("demo: pricing daily cost", () => {
  test("records daily cost trend and aggregate spend context", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);

    // Page-ready: the summary block + trend chart are the live page's anchors.
    await expect(page.getByTestId("pricing-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("pricing-chart")).toBeVisible();
    // Trim the skeleton lead-in so the opening frames are the populated screen.
    await settleLoaded(page);

    // --- Aggregate spend context: the three summary cards, left to right. ---
    await hoverFirstVisible(page, "pricing-card-total-spend");
    await hoverFirstVisible(page, "pricing-card-run-count");
    await hoverFirstVisible(page, "pricing-card-avg-cost");

    // --- Daily cost trend: hover the spend-over-time chart for its tooltip. ---
    await hoverFirstVisible(page, "pricing-chart");
    await scrollToText(page, /spend over time/i);
    await pauseForDemo();

    // --- Toolbar: open the date-range picker, reveal the calendar, dismiss. ---
    const dateButton = page.locator("#date").first();
    if (await dateButton.isVisible().catch(() => false)) {
      await dateButton.click();
      // The popover renders a react-day-picker calendar grid; hold so it reads.
      await page
        .getByRole("grid")
        .first()
        .waitFor({ state: "visible", timeout: 5_000 })
        .catch(() => undefined);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // --- Runs table: scroll it into frame and tour its controls. ---
    await scrollToText(page, /input tokens|output tokens|cost|runs/i);
    await hoverFirstVisible(page, "pricing-runs-table");

    // Search box: type so the typing shows, let it react, then clear it. The
    // input commits on Enter/blur; we type + clear without leaving a filter on.
    const search = page
      .getByPlaceholder("Search by model, agent, name, debug info...")
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click();
      await search.pressSequentially("gpt", { delay: 55 });
      await pauseForDemo(900);
      await search.fill("");
      await pauseForDemo(500);
    }

    // Column "View" options: open the toggle-columns dropdown, reveal, dismiss.
    const viewOptions = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewOptions.isVisible().catch(() => false)) {
      await viewOptions.click();
      await page
        .getByText("Toggle columns")
        .first()
        .waitFor({ state: "visible", timeout: 5_000 })
        .catch(() => undefined);
      await pauseForDemo(900);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // Rows-per-page selector: open the page-size dropdown, reveal options,
    // dismiss without committing a new size (read-only reveal).
    const pageSize = page.getByRole("combobox").first();
    if (await pageSize.isVisible().catch(() => false)) {
      await pageSize.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSize.click();
      await pauseForDemo(900);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // A sortable column header (re-orders rows, non-destructive view change),
    // and the per-row View link that drills into a group's cost breakdown —
    // hover only, no navigation, so the clip stays on this page.
    await hoverFirstVisible(page, "pricing-runs-table");
    const costHeader = page.getByRole("button", { name: /^Cost$/ }).first();
    await hoverFirstVisible(page, "pricing-runs-table");
    if (await costHeader.isVisible().catch(() => false)) {
      await costHeader.hover().catch(() => undefined);
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});
