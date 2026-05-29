import { expect, test } from "@playwright/test";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: index overview", () => {
  test("a 60-second orientation tour of the app", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();
    await scrollToText(page, /assigned|simulation|attempt|score/i);
    await saveDemoVideo(page, "index-overview");
  });
});
