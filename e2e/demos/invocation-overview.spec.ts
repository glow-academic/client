import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "invocation-overview";

test.describe("demo: invocation overview", () => {
  test("records benchmark invocation status and drill-in context", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /invocation|status|queued|running|completed|models/i);
    await page.getByPlaceholder("Search by name, eval, or models...").fill("eval").catch(() => undefined);
    await pauseForDemo();

    await saveDemoVideo(page, TOPIC);
  });
});
