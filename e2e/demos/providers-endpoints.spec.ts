import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-endpoints";

test.describe("demo: providers endpoints", () => {
  test("records endpoint configuration for a provider", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/providers/new");
    await showFormStep(page, "endpoint");
    await scrollToText(page, /endpoint|base url|regional|gateway/i);
    await saveDemoVideo(page, TOPIC);
  });
});
