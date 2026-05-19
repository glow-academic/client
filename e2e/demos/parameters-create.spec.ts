import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-create";

test.describe("demo: parameters create", () => {
  test("records parameter name, description, department, and flags", async ({ page }) => {
    await openArtifactForm(page, "/management/parameters/new");
    await page.getByPlaceholder(/student age/i).fill("Temperament");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("The emotional disposition of the AI student character.");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
