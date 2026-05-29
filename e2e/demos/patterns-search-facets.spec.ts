import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-search-facets";

test.describe("demo: patterns search facets", () => {
  test("records server-hydrated search facets on an artifact list", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/training/personas",
      toolbar: "personas-toolbar",
      surface: "personas-grid",
      search: "personas-search",
      query: "student",
      card: "persona-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});