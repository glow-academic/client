import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-bulk";

test.describe("demo: agents bulk", () => {
  test("records the selectable grid and bulk-operation affordances", async ({ page }) => {
    await page.goto("/intelligence/agents");
    await expectAuthenticated(page);

    await expect(page.getByTestId("agents-grid")).toBeVisible({ timeout: 30_000 });
    await hoverFirstVisible(page, "agent-card");
    await scrollToText(page, /select|bulk|delete|edit/i);
    await pauseForDemo();

    await saveDemoVideo(page, TOPIC);
  });
});
