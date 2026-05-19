import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-search";

test.describe("demo: evals search", () => {
  test("records eval search with model, rubric, and department filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/system/evals",
      toolbar: "evals-toolbar",
      surface: "evals-grid",
      search: "evals-search",
      query: "fall",
      card: "eval-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
