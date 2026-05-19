import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-draft";

test.describe("demo: models draft", () => {
  test("records draft controls for staged model changes", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/models/new");
    await page.getByRole("textbox", { name: /value/i }).fill("draft-model-demo");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
