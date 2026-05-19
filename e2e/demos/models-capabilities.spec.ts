import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-capabilities";

test.describe("demo: models capabilities", () => {
  test("records modality, temperature, reasoning, pricing, voice, and quality sections", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/models/new");
    await showFormStep(page, "basic");
    await scrollToText(page, /modalities enabled|temperature enabled|reasoning levels enabled|pricing enabled|voices enabled|qualities enabled/i);
    await showFormStep(page, "provider");
    await saveDemoVideo(page, TOPIC);
  });
});
