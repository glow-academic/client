import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-wiring";

test.describe("demo: evals wiring", () => {
  test("records model, flag, position, and rubric wiring", async ({ page }) => {
    await openArtifactForm(page, "/platform/evals/new");
    await page.getByPlaceholder(/eval name/i).fill("Evaluator Wiring Demo");
    await showFormStep(page, "models");
    await scrollToText(page, /search models|model flags|model positions|model rubrics/i);
    await saveDemoVideo(page, TOPIC);
  });
});
