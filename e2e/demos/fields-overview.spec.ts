import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-overview";

test.describe("demo: fields overview", () => {
  test("records the fields grid grouped by parameter context", async ({ page }) => {
    await openLibrary(page, "/management/fields", "fields-toolbar", "fields-grid");
    await hoverFirstVisible(page, /^field-card-/);
    await scrollToText(page, /parameters|personas|departments|description/i);
    await saveDemoVideo(page, TOPIC);
  });
});
