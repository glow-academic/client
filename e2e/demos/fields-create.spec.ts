import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-create";

test.describe("demo: fields create", () => {
  test("records field name, description, and department setup", async ({ page }) => {
    await openArtifactForm(page, "/management/fields/new");
    await page.getByPlaceholder(/learning style/i).fill("Confused");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("The AI student is uncertain and asks clarifying questions.");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
