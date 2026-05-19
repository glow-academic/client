import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-create";

test.describe("demo: agents create", () => {
  test("records the new agent draft surface and read-only guard", async ({ page }) => {
    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    await expect(page.getByRole("link", { name: /new agent/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /agent is read-only/i })).toBeVisible();
    await pauseForDemo();

    await page.getByPlaceholder(/customer support agent/i).scrollIntoViewIfNeeded();
    await pauseForDemo();

    await scrollToText(page, /model/i);

    await saveDemoVideo(page, TOPIC);
  });
});
