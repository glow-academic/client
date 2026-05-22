import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-overview";

test.describe("demo: evals overview", () => {
  test("records eval cards with run, model, rubric, and department context", async ({ page }) => {
    await openLibrary(page, "/platform/evals", "evals-toolbar", "evals-grid");
    await hoverFirstVisible(page, "eval-card");
    await scrollToText(page, /models|rubrics|runs|departments/i);
    await saveDemoVideo(page, TOPIC);
  });
});
