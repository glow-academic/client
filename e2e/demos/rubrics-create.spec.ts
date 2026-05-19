import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-create";

test.describe("demo: rubrics create", () => {
  test("records the basic rubric creation form", async ({ page }) => {
    await openArtifactForm(page, "/system/rubrics/new");
    await page.getByPlaceholder(/sales call rubric/i).fill("Communication Skills Demo");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
