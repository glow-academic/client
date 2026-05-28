// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "invocation-list-paginate";

test.describe("demo: invocation list paginate", () => {
  test("records benchmark history search and pagination controls", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await page.getByPlaceholder("Search by name, eval, or models...").fill("model").catch(() => undefined);
    await pauseForDemo();
    await scrollToText(page, /rows per page|page|next|previous|history/i);

    await saveDemoVideo(page, TOPIC);
  });
});