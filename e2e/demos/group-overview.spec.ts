import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "group-overview";

/**
 * # coverage: full-page tour of the pricing GROUPS overview
 * (`/analytics/pricing`) — the surface that lists each grouped AI run as a
 * row (group name, profile, agents, models, run count, token totals, cost).
 *
 * Top-to-bottom we: read the three summary cards (total spend / run count /
 * avg cost) and the spend-over-time chart, hover a group row, type into the
 * runs search box and clear it, open the column-visibility ("View") menu and
 * dismiss it, open the toolbar date-range calendar and dismiss it, page the
 * runs table forward then back, and Reset to the default view.
 *
 * Every beat past the single page-ready assertion (`pricing-runs-table`) is
 * guarded — a control only renders when its data/visibility flag is present,
 * so each step no-ops when absent and can never fail the recording (handy on a
 * sparse/$0 instance). All actions are READ-ONLY / reversible: searching and
 * filtering only re-query, the date calendar is opened-then-Escaped without
 * committing a range, the group "View" links are hovered (never clicked, so we
 * never navigate away), and Reset restores defaults. Nothing is mutated.
 */
test.describe("demo: group overview", () => {
  test("tours the grouped AI run analytics on the pricing overview", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Beat 1: the summary cards across the top — spend, runs, avg cost.
    await hoverFirstVisible(page, "pricing-card-total-spend");
    await hoverFirstVisible(page, "pricing-card-run-count");
    await hoverFirstVisible(page, "pricing-card-avg-cost");

    // Beat 2: the spend-over-time chart below the cards.
    const chart = page.getByTestId("pricing-chart").first();
    if (await chart.isVisible().catch(() => false)) {
      await chart.scrollIntoViewIfNeeded().catch(() => undefined);
      await chart.hover().catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // Beat 3: down to the grouped-runs table and hover the first group row.
    await scrollToText(page, /Created|Profile|Runs|Cost/i);
    const firstRow = page.getByTestId("pricing-runs-table").locator("tbody tr").first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstRow.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // Beat 4: type into the runs search so it visibly re-queries, then clear it.
    const search = page
      .getByPlaceholder("Search by model, agent, name, debug info...")
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.click();
      await search.pressSequentially("group", { delay: 55 });
      await pauseForDemo(900);
      await waitOutSkeleton(page);
      await pauseForDemo(1_100);
      await search.fill("");
      await waitOutSkeleton(page);
      await pauseForDemo(900);
    }

    // Beat 5: the column-visibility ("View") menu — reveal the toggles, dismiss.
    const viewButton = page.getByRole("button", { name: /^view$/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewButton.click();
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 6: the toolbar date-range picker — open the calendar, Escape (no commit).
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.click();
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // Beat 7: page the runs table forward then back — read-only navigation.
    const nextPage = page.getByRole("button", { name: /go to next page/i }).first();
    if ((await nextPage.isVisible().catch(() => false)) && (await nextPage.isEnabled().catch(() => false))) {
      await nextPage.scrollIntoViewIfNeeded().catch(() => undefined);
      await nextPage.click();
      await waitOutSkeleton(page);
      await pauseForDemo(1_200);
      const prevPage = page.getByRole("button", { name: /go to previous page/i }).first();
      if (await prevPage.isVisible().catch(() => false)) {
        await prevPage.click();
        await waitOutSkeleton(page);
        await pauseForDemo(1_000);
      }
    }

    // Beat 8: Reset clears any lingering filter state back to the default view.
    const resetButton = page.getByRole("button", { name: /^reset/i }).first();
    if (await resetButton.isVisible().catch(() => false)) {
      await resetButton.click();
      await waitOutSkeleton(page);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
