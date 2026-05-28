// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "media-upload";

test.describe("demo: media upload", () => {
  test("records the document upload step and file attachment controls", async ({ page }) => {
    await openArtifactForm(page, "/management/documents/new");
    await showFormStep(page, "uploads");

    await scrollToText(page, /upload|file|select|media|document/i);

    await saveDemoVideo(page, TOPIC);
  });
});