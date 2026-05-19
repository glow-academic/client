import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-draft";

test.describe("demo: rubrics draft", () => {
  test("records draft controls for rubric scoring edits", async ({ page }) => {
    await openArtifactForm(page, "/system/rubrics/new");
    await page.getByPlaceholder(/sales call rubric/i).fill("Draft Rubric Demo");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
