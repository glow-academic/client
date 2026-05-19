import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-create";

test.describe("demo: providers create", () => {
  test("records the provider basic form and endpoint setup", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/providers/new");
    await page.getByPlaceholder(/openai/i).fill("Anthropic Production Demo");
    await showFormStep(page, "endpoint");
    await saveDemoVideo(page, TOPIC);
  });
});
