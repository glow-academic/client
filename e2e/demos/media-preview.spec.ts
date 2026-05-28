// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "media-preview";

test.describe("demo: media preview", () => {
  test("records document preview thumbnails and preview actions", async ({ page }) => {
    await openLibrary(page, "/management/documents", "documents-toolbar", "documents-table");

    await hoverFirstVisible(page, /^preview-/);
    const preview = page.getByTestId(/^preview-/).first();
    if (await preview.isVisible().catch(() => false)) {
      await preview.click();
      await pauseForDemo();
    }
    await scrollToText(page, /preview|file|document|image|pdf/i);

    await saveDemoVideo(page, TOPIC);
  });
});