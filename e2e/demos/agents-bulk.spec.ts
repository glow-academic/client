import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-bulk";

test.describe("demo: agents bulk", () => {
  test("select multiple agents and open the bulk-edit action (non-destructive)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Open the agents library on the LOADED, populated grid.
    await page.goto("/intelligence/agents");
    await expectAuthenticated(page);

    // The single real page-ready assertion: the cards grid container. If the
    // page is totally broken this still surfaces.
    await expect(page.getByTestId("agents-grid")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Beat 1 — select the FIRST agent card. Clicking the card body toggles
    // selection (the card gains a primary ring + a checkmark, and the toolbar
    // swaps into the selection action bar). Guarded: if no cards loaded, the
    // whole selection sequence simply no-ops.
    const cards = page.getByTestId("agent-card");
    const cardCount = await cards.count().catch(() => 0);

    if (cardCount > 0) {
      const first = cards.nth(0);
      if (await first.isVisible().catch(() => false)) {
        await first.scrollIntoViewIfNeeded().catch(() => undefined);
        await first.click().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // Beat 2 — select a SECOND card so the selection is visibly plural
      // ("2" reflected in the toolbar's action labels).
      if (cardCount > 1) {
        const second = cards.nth(1);
        if (await second.isVisible().catch(() => false)) {
          await second.scrollIntoViewIfNeeded().catch(() => undefined);
          await second.click().catch(() => undefined);
          await pauseForDemo(1_200);
        }
      }

      // Beat 3 — select a THIRD card if present, building a clear multi-select.
      if (cardCount > 2) {
        const third = cards.nth(2);
        if (await third.isVisible().catch(() => false)) {
          await third.scrollIntoViewIfNeeded().catch(() => undefined);
          await third.click().catch(() => undefined);
          await pauseForDemo(1_200);
        }
      }
    }

    // Beat 4 — hold on the selection action bar so the viewer reads the live
    // selection state (the bulk Delete / Edit buttons with their counts).
    const toolbar = page.getByTestId("agents-toolbar");
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    // Beat 5 — open the NON-DESTRUCTIVE bulk action: the bulk-Edit modal.
    // Its label is either "Edit N of M" (explicit selection) or
    // "Edit N matching" (select-all mode), so match either. Guarded — a
    // missing button leaves the clip on the populated, selected grid.
    const bulkEditBtn = page
      .getByRole("button", { name: /^Edit \d+ (of \d+|matching)$/ })
      .first();
    if (await bulkEditBtn.isVisible().catch(() => false)) {
      await bulkEditBtn.click().catch(() => undefined);

      // The bulk-edit modal — show its fields (Active status / MCP toggles).
      const dialog = page.getByTestId("dialog-bulk-edit");
      if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await pauseForDemo(1_500);

        // SAFETY: do NOT apply. Cancel out of the modal — the bulk action is
        // shown but never committed.
        const cancel = dialog.getByRole("button", { name: /^Cancel$/ }).first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click().catch(() => undefined);
          await pauseForDemo(1_200);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
          await pauseForDemo(1_200);
        }
      }
    }

    // End on the populated grid with the selection still visible.
    if (await toolbar.isVisible().catch(() => false)) {
      await pauseForDemo(1_100);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
