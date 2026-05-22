import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-search";

test.describe("demo: auths search", () => {
  test("records auth search with department and item filters", async ({ page }) => {
    await page.goto("/platform/auth");
    await expectAuthenticated(page);
    await expect(page.getByTestId("auths-toolbar")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();
    await scrollToText(page, /department|auth items|settings/i);
    await hoverFirstVisible(page, "auth-card");
    await saveDemoVideo(page, TOPIC);
  });
});
