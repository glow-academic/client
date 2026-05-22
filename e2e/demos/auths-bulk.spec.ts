import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-bulk";

test.describe("demo: auths bulk", () => {
  test("records auth selection and all-matching bulk affordances", async ({ page }) => {
    await page.goto("/platform/auth");
    await expectAuthenticated(page);
    await expect(page.getByTestId("auths-toolbar")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();
    await hoverFirstVisible(page, "auth-card");
    await scrollToText(page, /select|bulk|delete|edit|matching/i);
    await saveDemoVideo(page, TOPIC);
  });
});
