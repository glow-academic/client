import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-detail-view";

// # coverage: tour the WHOLE session detail page — summary header card
// (status badge + Profile/Created/Events/Groups fields) then the full
// chronological Timeline (Group/Chat/Attempt/Login event cards) — entered
// by clicking a real session row on the activity list. Every beat past the
// ONE page-ready assertion no-ops if its target is absent.

test.describe("demo: session detail view", () => {
  test("opens a session row and tours the full session detail page", async ({ page }) => {
    // ---- Land on the activity list and settle on the populated table. ----
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // ---- Surface a real session row, then click it to navigate to the full
    // detail page (the row links to /analytics/activity/{sessionId}). ----
    const firstRow = page.getByTestId(/^activity-session-row-/).first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstRow.hover().catch(() => undefined);
      await pauseForDemo(1_100);
      await firstRow.click().catch(() => undefined);
    }

    // ---- Wait out the route transition BEFORE recording any detail beat:
    // settle the URL on the detail route, drain the loading skeleton, and
    // assert the LOADED detail content is on frame. This is the single
    // page-ready signal — nothing past here is captured until the populated
    // "Session Detail" header card is visible, so no skeleton frame and no
    // abrupt context jump are recorded. ----
    await page
      .waitForURL(/\/analytics\/activity\/[^/]+$/, { timeout: 15_000 })
      .catch(() => undefined);
    await waitOutSkeleton(page);

    const detailHeader = page.getByText("Session Detail", { exact: true }).first();
    if (await detailHeader.isVisible({ timeout: 15_000 }).catch(() => false)) {
      // Page is loaded — hold one beat on the populated header so the detail
      // screen, not the transition, opens this leg of the clip.
      await expect(detailHeader).toBeVisible();
      await settleLoaded(page);

      // ---- Beat 1: linger on the header card — the Active/Inactive status
      // badge plus the at-a-glance summary fields. ----
      await scrollToText(page, /^(Active|Inactive)$/);
      await pauseForDemo(900);
      await scrollToText(page, /Profile:/i);
      await scrollToText(page, /Created:/i);
      await scrollToText(page, /Events:/i);
      await scrollToText(page, /Groups:/i);
      await pauseForDemo(1_200);

      // ---- Beat 2: move to the Timeline header so the chronological event
      // feed is clearly the focus. ----
      await scrollToText(page, /^Timeline$/);
      await pauseForDemo(1_100);

      // ---- Beat 3: hover an event icon to reveal its type tooltip, then
      // scroll through the timeline event cards (group, chat, attempt,
      // login) so the rich per-event detail reads. Read-only — the cards
      // link out, so we scroll/hover only and never click them. ----
      await hoverLocatorIfVisible(page.locator("svg.lucide").first());
      await pauseForDemo(900);
      for (const label of [/^Group$/, /^Chat$/, /^Attempt$/, /^Login$/, /^Practice$/]) {
        await scrollToText(page, label);
      }
      await pauseForDemo(1_300);
    } else {
      // Detail page did not open (no rows / empty data) — hold on whatever
      // the list rendered so the clip still ends on substantive content.
      await pauseForDemo(1_300);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
