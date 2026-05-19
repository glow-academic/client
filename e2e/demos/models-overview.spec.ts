import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-overview";

test.describe("demo: models overview", () => {
  test("records model cards with provider and modality context", async ({ page }) => {
    await openLibrary(page, "/intelligence/models", "models-toolbar", "models-grid");
    await hoverFirstVisible(page, "model-card");
    await scrollToText(page, /provider|modality|agent|custom/i);
    await saveDemoVideo(page, TOPIC);
  });
});
