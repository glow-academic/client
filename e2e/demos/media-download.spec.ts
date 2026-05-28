// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "media-download";

test.describe("demo: media download", () => {
  test("records document media rows and export/download affordances", async ({ page }) => {
    await openLibrary(page, "/management/documents", "documents-toolbar", "documents-table");

    await hoverFirstVisible(page, "documents-row");
    await scrollToText(page, /file|download|export|document|preview/i);

    await saveDemoVideo(page, TOPIC);
  });
});