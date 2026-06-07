import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-detail-view";

test.describe("demo: session detail view", () => {
  test("clicks an activity row through to its full session detail page", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    // AUDIT FIX: the old demo only hovered + scrolled the activity list and
    // never navigated, so it filmed nothing of the page it is NAMED for. Now
    // we CLICK a real session row → land on /analytics/activity/{sessionId} →
    // assert the session-detail content rendered.
    //
    // Each session row carries data-testid="activity-session-row-{sessionId}"
    // and onClick router.push()es to its detail page (Activity.tsx). Take the
    // first real row; fail loud if the seeded list has none (no row to feature).
    const row = page.getByTestId(/^activity-session-row-/).first();
    await expect(
      row,
      "no activity session row to click through — seed at least one session before recording",
    ).toBeVisible({ timeout: 30_000 });
    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo();
    await row.click();

    // The click navigates to the detail route. Assert the URL changed AND the
    // loaded Session component rendered its header card (data-testid
    // "session-detail" — present only when session_exists, i.e. the happy
    // path; the "Session not found" branch omits it, so this fails loud on a
    // missing/erroring session).
    await expect(page).toHaveURL(/\/analytics\/activity\/[^/]+$/, { timeout: 30_000 });
    await expectAuthenticated(page);
    await expect(
      page.getByTestId("session-detail"),
      "session detail page did not render its content (no `session-detail`) — the row click did not reach a loaded detail page",
    ).toBeVisible({ timeout: 30_000 });

    // Tour the detail content for the camera (read-only).
    await pauseForDemo();
    await scrollToText(page, /session detail/i);
    await scrollToText(page, /timeline|profile|events|groups/i);

    await saveDemoVideo(page, TOPIC);
  });
});
