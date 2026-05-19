import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-overview";

test.describe("demo: parameters overview", () => {
  test("records parameter cards with field counts and usage context", async ({ page }) => {
    await openLibrary(page, "/management/parameters", "parameters-toolbar", "parameters-grid");
    await hoverFirstVisible(page, "parameter-card");
    await scrollToText(page, /fields|scenarios|departments|default/i);
    await saveDemoVideo(page, TOPIC);
  });
});
