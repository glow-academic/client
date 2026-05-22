import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-overview";

test.describe("demo: auths overview", () => {
  test("records auth provider cards with protocol, item, and department context", async ({ page }) => {
    await page.goto("/platform/auth");
    await expectAuthenticated(page);
    await expect(page.getByTestId("auths-toolbar")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();
    await hoverFirstVisible(page, "auth-card");
    await scrollToText(page, /settings|auth items|department|protocol/i);
    await saveDemoVideo(page, TOPIC);
  });
});
