import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-edit";

test.describe("demo: scenarios edit", () => {
  test("records persona, document, parameter, and objective sections", async ({ page }) => {
    await openArtifactForm(page, "/training/scenarios/new");
    await showFormStep(page, "personas");
    await showFormStep(page, "documents");
    await showFormStep(page, "parameters");
    await scrollToText(page, /problem statement|objectives/i);
    await saveDemoVideo(page, TOPIC);
  });
});
