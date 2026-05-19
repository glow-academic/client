import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-draft";

test.describe("demo: providers draft", () => {
  test("records draft controls for endpoint and key changes", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/providers/new");
    await page.getByPlaceholder(/openai/i).fill("Draft Provider Demo");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
