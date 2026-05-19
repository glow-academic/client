import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-search";

test.describe("demo: parameters search", () => {
  test("records parameter search with scenario, field, and department filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/management/parameters",
      toolbar: "parameters-toolbar",
      surface: "parameters-grid",
      search: "parameters-search",
      query: "Temperament",
      card: "parameter-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
