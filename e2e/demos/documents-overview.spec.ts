import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-overview";

test.describe("demo: documents overview", () => {
  test("records the documents table with type, field, and department context", async ({ page }) => {
    await openLibrary(page, "/management/documents", "documents-toolbar", "documents-table");
    await hoverFirstVisible(page, "documents-row");
    await scrollToText(page, /scenarios|fields|department|preview/i);
    await saveDemoVideo(page, TOPIC);
  });
});
