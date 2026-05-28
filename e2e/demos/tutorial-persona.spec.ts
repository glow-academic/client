// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-persona";

test.describe("demo: tutorial persona", () => {
  test("records the confused student persona draft", async ({ page }) => {
    await openArtifactForm(page, "/training/personas/new");
    await page.getByPlaceholder(/enthusiastic student/i).fill("Confused Student");
    await page
      .getByTestId("input-persona-description")
      .fill("Seeks to understand by asking questions and exploring ideas.");
    await showFormStep(page, "content");
    await page
      .getByTestId("input-instructions")
      .fill("You are a confused undergraduate student in office hours. Do not solve independently; only make progress when the TA gives specific, relevant guidance.");
    await saveDemoVideo(page, TOPIC);
  });
});