// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "index-sidebar";

test.describe("demo: index sidebar", () => {
  test("records sidebar navigation, search, and page shell controls", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("page-header")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await page.getByPlaceholder("Search...").first().fill("training");
    await pauseForDemo();
    await scrollToText(page, /home|practice|training|analytics|management/i);
    await page.getByTestId("toggle-left-sidebar").hover();
    await pauseForDemo();

    await saveDemoVideo(page, TOPIC);
  });
});