import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-search";

test.describe("demo: models search", () => {
  test("records model search and provider/department filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/intelligence/models",
      toolbar: "models-toolbar",
      surface: "models-grid",
      search: "models-search",
      query: "gpt",
      card: "model-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
