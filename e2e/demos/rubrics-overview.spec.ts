import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-overview";

test.describe("demo: rubrics overview", () => {
  test("records rubric cards with scoring and usage context", async ({ page }) => {
    await openLibrary(page, "/system/rubrics", "rubrics-toolbar", "rubrics-grid");
    await hoverFirstVisible(page, "rubric-card");
    await scrollToText(page, /points|pass|standard|simulation/i);
    await saveDemoVideo(page, TOPIC);
  });
});
