import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-overview";

test.describe("demo: departments overview", () => {
  test("records department cards with membership and settings context", async ({ page }) => {
    await openLibrary(page, "/system/departments", "departments-toolbar", "departments-grid");
    await hoverFirstVisible(page, "department-card");
    await scrollToText(page, /profiles|settings|login|staff/i);
    await saveDemoVideo(page, TOPIC);
  });
});
