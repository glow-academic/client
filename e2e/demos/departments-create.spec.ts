import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-create";

test.describe("demo: departments create", () => {
  test("records department name and description setup", async ({ page }) => {
    await openArtifactForm(page, "/system/departments/new");
    await page.getByPlaceholder(/customer success/i).fill("University");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("Innovative base of knowledge in the emerging field of computing.");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
