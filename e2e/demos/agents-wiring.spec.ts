import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-wiring";

test.describe("demo: agents wiring", () => {
  test("records model, tool, and rubric wiring sections", async ({ page }) => {
    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    await expect(page.getByRole("heading", { name: /agent is read-only/i })).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder(/customer support agent/i).scrollIntoViewIfNeeded();
    await pauseForDemo();

    await scrollToText(page, /^Tools$/i);
    await scrollToText(page, /^Model$/i);
    await scrollToText(page, /^Rubrics?$/i);

    await saveDemoVideo(page, TOPIC);
  });
});
