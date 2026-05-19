import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-draft";

test.describe("demo: tools draft", () => {
  test("records draft controls for staged tool changes", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/tools/new");
    await page.getByPlaceholder(/calculator/i).fill("draft_policy_lookup");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
