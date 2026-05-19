import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-rubric";

test.describe("demo: tutorial rubric", () => {
  test("records the TA office-hours rubric setup", async ({ page }) => {
    await openArtifactForm(page, "/system/rubrics/new");
    await page.getByPlaceholder(/sales call rubric/i).fill("TA Office Hours Assessment");
    await showFormStep(page, "basic");
    await showFormStep(page, "standard_groups");
    await showFormStep(page, "standards");
    await saveDemoVideo(page, TOPIC);
  });
});
