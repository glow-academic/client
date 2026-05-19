import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-overview";

test.describe("demo: scenarios overview", () => {
  test("records scenario cards with persona/document context", async ({ page }) => {
    await openLibrary(page, "/training/scenarios", "scenarios-toolbar", "scenarios-grid");
    await hoverFirstVisible(page, "scenario-card");
    await scrollToText(page, /persona|document|objective|problem/i);
    await saveDemoVideo(page, TOPIC);
  });
});
