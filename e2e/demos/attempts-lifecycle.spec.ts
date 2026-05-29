import { expect, test } from "@playwright/test";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: attempts lifecycle", () => {
  test("attempt status states on the home deck", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();
    await scrollToText(page, /passed|in progress|not started|completed|attempt/i);
    await saveDemoVideo(page, "attempts-lifecycle");
  });
});
