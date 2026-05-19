import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-create";

test.describe("demo: models create", () => {
  test("records the model name, description, and provider form", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/models/new");
    await page.getByRole("textbox", { name: /value/i }).fill("gpt-4o-sim-demo");
    await page.getByPlaceholder(/brief description/i).fill("Text model configured for learner simulations.");
    await showFormStep(page, "provider");
    await saveDemoVideo(page, TOPIC);
  });
});
