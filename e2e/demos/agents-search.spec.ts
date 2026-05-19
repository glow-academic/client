import { expect, test } from "@playwright/test";

import { expectAuthenticated, fillSearch, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-search";

test.describe("demo: agents search", () => {
  test("records text search and filter controls", async ({ page }) => {
    await page.goto("/intelligence/agents");
    await expectAuthenticated(page);

    await expect(page.getByTestId("agents-toolbar")).toBeVisible({ timeout: 30_000 });
    await fillSearch(page, "agents-search", "grading");

    await scrollToText(page, /Tool|Model|Department/i);
    await hoverFirstVisible(page, "agent-card");
    await pauseForDemo();

    await saveDemoVideo(page, TOPIC);
  });
});
