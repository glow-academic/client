import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-create";

test.describe("demo: evals create", () => {
  test("records eval name, description, flags, and department setup", async ({ page }) => {
    await openArtifactForm(page, "/system/evals/new");
    await page.getByPlaceholder(/eval name/i).fill("Fall 2025 TA Assessment");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("Automated scoring of TA office hour simulations.");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
