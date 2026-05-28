// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-points";

test.describe("demo: rubrics points", () => {
  test("records point totals, pass thresholds, and usage warnings", async ({ page }) => {
    await openLibrary(page, "/platform/rubrics", "rubrics-toolbar", "rubrics-grid");
    await hoverFirstVisible(page, "rubric-card");
    await scrollToText(page, /points|pass percentage|pass threshold|active simulation/i);
    await saveDemoVideo(page, TOPIC);
  });
});