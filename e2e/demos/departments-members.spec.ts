// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-members";

test.describe("demo: departments members", () => {
  test("records department member and login-count context", async ({ page }) => {
    await openLibrary(page, "/platform/departments", "departments-toolbar", "departments-grid");
    await hoverFirstVisible(page, "department-card");
    await scrollToText(page, /profiles|staff|login|members/i);
    await saveDemoVideo(page, TOPIC);
  });
});