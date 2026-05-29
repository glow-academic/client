import { expect, test } from "@playwright/test";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: index sidebar", () => {
  test("the left-nav mapping to the running UI", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await pauseForDemo();
    await scrollToText(page, /Training|Management|Intelligence|Platform|Analytics/i);
    await saveDemoVideo(page, "index-sidebar");
  });
});
