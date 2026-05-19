import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-overview";

test.describe("demo: agents overview", () => {
  test("records the agents library with model/tool context", async ({ page }) => {
    await page.goto("/intelligence/agents");
    await expectAuthenticated(page);

    await expect(page.getByTestId("agents-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("agents-grid")).toBeVisible();
    await pauseForDemo();

    await hoverFirstVisible(page, "agent-card");
    await scrollToText(page, /model|tool|department/i);

    await saveDemoVideo(page, TOPIC);
  });
});
