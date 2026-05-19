import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-draft";

test.describe("demo: scenarios draft", () => {
  test("records draft controls while staging scenario edits", async ({ page }) => {
    await openArtifactForm(page, "/training/scenarios/new");
    await page.getByPlaceholder(/customer support escalation/i).fill("Draft Scenario Demo");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
