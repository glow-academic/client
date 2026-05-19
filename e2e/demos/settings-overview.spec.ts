import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-overview";

test.describe("demo: settings overview", () => {
  test("records the settings grid and composed configuration filters", async ({ page }) => {
    await openLibrary(page, "/settings", "settings-toolbar", "settings-grid");
    await hoverFirstVisible(page, "setting-card");
    await scrollToText(page, /providers|auth|systems|departments/i);
    await saveDemoVideo(page, TOPIC);
  });
});
