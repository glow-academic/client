// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-cohort";

test.describe("demo: tutorial cohort", () => {
  test("records assigning simulations and profiles to a TA cohort", async ({ page }) => {
    await openArtifactForm(page, "/training/cohorts/new");
    await page.getByPlaceholder(/spring 2024 cohort/i).fill("Fall 2025 CS TAs");
    await showFormStep(page, "simulations");
    await scrollToText(page, /search simulations|simulation availability|simulation positions/i);
    await showFormStep(page, "profiles");
    await scrollToText(page, /search profiles|profile personas/i);
    await saveDemoVideo(page, TOPIC);
  });
});