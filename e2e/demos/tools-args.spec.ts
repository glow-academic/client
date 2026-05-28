// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-args";

test.describe("demo: tools args", () => {
  test("records argument, position, and output configuration", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/tools/new");
    await showFormStep(page, "arguments");
    await scrollToText(page, /argument name|field type|output|template/i);
    await saveDemoVideo(page, TOPIC);
  });
});