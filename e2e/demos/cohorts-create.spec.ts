import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-create";

test.describe("demo: cohorts create", () => {
  test("records cohort name, description, and department setup", async ({ page }) => {
    await openArtifactForm(page, "/training/cohorts/new");
    await page.getByPlaceholder(/spring 2024 cohort/i).fill("Practice Cohort");
    await page
      .getByPlaceholder(/detailed description of the cohort/i)
      .fill("Practice simulations for CS instructional staff.");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
