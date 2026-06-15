import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "activity-session-history";

test.describe("demo: activity session history", () => {
  test("records session search, filter and drill-in rows", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    // Single real page-ready assertion: a broken page still surfaces here.
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton + tour the header metrics so the clip opens on the
    // populated activity overview rather than the shimmer.
    await settleLoaded(page, { hoverTestIds: ["activity-metrics"] });

    // Beat 1: scroll down to the session history table — the feature itself.
    await scrollToText(page, /Search sessions|session/i);
    await pauseForDemo(1_200);

    // Beat 2: type into the session search so a viewer sees the table react.
    const search = page.getByTestId("activity-search");
    if (await search.isVisible().catch(() => false)) {
      await search.click();
      await search.pressSequentially("session", { delay: 55 });
      await pauseForDemo(1_300);
    }

    // Beat 3: open the Profile faceted filter to show history can be scoped per
    // profile, then close it (non-destructive, no selection committed).
    const profileFilter = page.getByRole("button", { name: /Profile/i }).first();
    if (await profileFilter.isVisible().catch(() => false)) {
      await profileFilter.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape");
      await pauseForDemo(900);
    }

    // Beat 4: surface a session row so the drill-in target reads clearly. We
    // hover (not click) to keep the recording on the history table itself.
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible();
    await hoverFirstVisible(page, /^activity-session-row-/);
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
