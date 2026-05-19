import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-edit";

test.describe("demo: cohorts edit", () => {
  test("records cohort composition across simulations and profiles", async ({ page }) => {
    await openArtifactForm(page, "/training/cohorts/new");
    await page.getByPlaceholder(/spring 2024 cohort/i).fill("Training Cohort");
    await showFormStep(page, "simulations");
    await scrollToText(page, /simulation positions|simulation availability|search simulations/i);
    await showFormStep(page, "profiles");
    await scrollToText(page, /profile personas|search profiles/i);
    await saveDemoVideo(page, TOPIC);
  });
});
