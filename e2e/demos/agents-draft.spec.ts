import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-draft";

test.describe("demo: agents draft", () => {
  test("records the draft toolbar and optimistic-edit surface", async ({ page }) => {
    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    await expect(page.getByRole("heading", { name: /agent is read-only/i })).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder(/customer support agent/i).scrollIntoViewIfNeeded();
    await pauseForDemo();

    await scrollToText(page, /Create Agent|Draft agent|Iterate draft/i);

    await saveDemoVideo(page, TOPIC);
  });
});
