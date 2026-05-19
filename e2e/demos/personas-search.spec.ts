import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-search";

test.describe("demo: personas search", () => {
  test("records text search and persona facets", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/training/personas",
      toolbar: "personas-toolbar",
      surface: "personas-grid",
      search: "personas-search",
      query: "confused",
      card: "persona-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
