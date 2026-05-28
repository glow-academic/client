// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-scenario";

test.describe("demo: tutorial scenario", () => {
  test("records the help-with-loops scenario setup", async ({ page }) => {
    await openArtifactForm(page, "/training/scenarios/new");
    await page.getByPlaceholder(/customer support escalation/i).fill("Office Hours: Help with Loops");
    await page
      .getByPlaceholder(/describe the scenario/i)
      .fill("A confused student needs help reasoning through loop structure without being handed the answer.");
    await scrollToText(page, /problem statement|objectives/i);
    await showFormStep(page, "personas");
    await showFormStep(page, "parameters");
    await saveDemoVideo(page, TOPIC);
  });
});