import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: pricing per-model cost breakdown — column-View menu reveals the
// model/token/cost columns, hover the cost cells, exercise the Models sort +
// model facet + search; all non-destructive (open then Escape, sort reset).
const TOPIC = "pricing-model-breakdown";

test.describe("demo: pricing model breakdown", () => {
  test("records model/token/cost columns, the column-View menu, and model facets", async ({
    page,
  }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);

    // Single page-ready assertion. Everything after this is guarded so a beat
    // whose target is absent simply no-ops.
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page, { scrollTexts: [/runs|models|tokens|cost/i] });

    // Tour the per-model cost columns top->bottom so each header reads on frame.
    await scrollToText(page, /^Models$/);
    await scrollToText(page, /Input Tokens/i);
    await scrollToText(page, /Output Tokens/i);
    await scrollToText(page, /^Cost$/);

    // Reveal the model/token/cost columns via the column-View menu (open then
    // Escape — no commit). "Toggle columns" lists Models / Input Tokens /
    // Output Tokens / Cost as checkbox items.
    const viewMenu = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewMenu.isVisible().catch(() => false)) {
      await viewMenu.click().catch(() => undefined);
      await scrollToText(page, /Toggle columns/i);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo();
    }

    // Hover the formatted cost cells so the per-model dollar amounts read.
    const costCells = page.locator("td .font-medium.tabular-nums");
    const costCount = await costCells.count().catch(() => 0);
    for (let i = 0; i < Math.min(costCount, 3); i++) {
      const cell = costCells.nth(i);
      if (await cell.isVisible().catch(() => false)) {
        await cell.scrollIntoViewIfNeeded().catch(() => undefined);
        await cell.hover().catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    // Exercise the Models column sort: the header is a sort button that opens an
    // Asc/Desc/Hide menu. Open it to reveal the sort affordance, then Escape so
    // we never commit a re-sort.
    const modelsHeader = page.getByRole("button", { name: /^Models$/ }).first();
    if (await modelsHeader.isVisible().catch(() => false)) {
      await modelsHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await modelsHeader.click().catch(() => undefined);
      await pauseForDemo(900);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo();
    }

    // Open the Cost sort menu too — the cost column is sortable — then dismiss.
    const costHeader = page.getByRole("button", { name: /^Cost$/ }).first();
    if (await costHeader.isVisible().catch(() => false)) {
      await costHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await costHeader.click().catch(() => undefined);
      await pauseForDemo(900);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo();
    }

    // Open the Model facet filter if present (only renders when model options
    // exist) — reveal the options, then Escape without selecting.
    const modelFacet = page.getByRole("button", { name: /^Model$/ }).first();
    if (await modelFacet.isVisible().catch(() => false)) {
      await modelFacet.scrollIntoViewIfNeeded().catch(() => undefined);
      await modelFacet.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo();
    }

    // Type a model query so the search visibly re-queries, then clear it so we
    // leave the table in its original (unfiltered) state.
    const search = page.getByPlaceholder("Search by model, agent, name, debug info...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("model", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_000);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(700);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
