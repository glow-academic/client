import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-tuning";

test.describe("demo: agents tuning", () => {
  test("records temperature, reasoning, and voice tuning sections", async ({ page }) => {
    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    await expect(page.getByTestId("input-agent-description")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /temperature/i);
    await scrollToText(page, /reasoning/i);
    await scrollToText(page, /^Voice|Voices/i);

    await saveDemoVideo(page, TOPIC);
  });
});