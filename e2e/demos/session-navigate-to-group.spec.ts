// TOPIC: session-navigate-to-group
// coverage: demonstrates the NAVIGATE action the demo is named for — from the
// Activity sessions table, open a session row and follow it through to the
// group/run detail it links to, so the clip actually shows the transition (not
// a frozen still of the activity dashboard, which the prior version recorded).
// settleLoaded() opens on the rendered table; every beat past the single
// page-ready assertion is guarded so it no-ops rather than fails.
//
// NON-DESTRUCTIVE: navigation/expansion only — nothing is created/edited/deleted.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-navigate-to-group";

async function visibleSoon(locator: Locator, timeout = 5_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: session navigate to group", () => {
  test("navigate from a session row through to its group/run detail", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);
    await pauseForDemo();

    // Read the first session row, then OPEN it (the navigate action).
    await hoverFirstVisible(page, /^activity-session-row-/);
    await pauseForDemo(700);

    const firstRow = page.locator('[data-testid^="activity-session-row-"]').first();
    if (await visibleSoon(firstRow)) {
      await firstRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstRow.click({ timeout: 8_000 }).catch(() => undefined);
      // The click navigates to the group/run detail, which loads via a
      // skeleton — wait it out so no shimmer frame lands in the clip.
      await settleLoaded(page);
      await pauseForDemo(900);

      // If the row surfaces an explicit group/run link, follow it.
      const groupLink = page.getByRole("link", { name: /group|run|view|detail/i }).first();
      if (await visibleSoon(groupLink, 3_000)) {
        await groupLink.scrollIntoViewIfNeeded().catch(() => undefined);
        await groupLink.click({ timeout: 8_000 }).catch(() => undefined);
        await settleLoaded(page);
        await pauseForDemo(900);
      }
    }

    // Tour whatever destination/expanded detail we landed on — guarded, so it
    // reads on either the expanded row or a group/run detail page.
    for (const text of [
      /Run\s+\d+\s+of\s+\d+/i,
      /group|runs|tokens|messages/i,
      /Cost|Input Tokens|Output Tokens/i,
      /Model:|Agent:|Profile:/i,
    ]) {
      await scrollToText(page, text).catch(() => undefined);
    }
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
