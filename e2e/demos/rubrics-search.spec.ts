import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-search";

test.describe("demo: rubrics search", () => {
  test("records rubric search and department filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/system/rubrics",
      toolbar: "rubrics-toolbar",
      surface: "rubrics-grid",
      search: "rubrics-search",
      query: "communication",
      card: "rubric-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
