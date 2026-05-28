// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-instructions";

test.describe("demo: personas instructions", () => {
  test("records instruction editing with placeholders", async ({ page }) => {
    await openArtifactForm(page, "/training/personas/new");
    await showFormStep(page, "content");
    await page.getByTestId("input-instructions").fill(
      "You are a student in {{class}} at {{location}}. Start defensive, then calm down when the instructor explains the policy.",
    );
    await saveDemoVideo(page, TOPIC);
  });
});