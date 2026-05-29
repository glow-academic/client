import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-provider-link";

test.describe("demo: models provider link", () => {
  test("records provider selection for a model", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/models/new");
    await showFormStep(page, "provider");
    await scrollToText(page, /provider|endpoint|key|OpenAI|Anthropic/i);
    await saveDemoVideo(page, TOPIC);
  });
});