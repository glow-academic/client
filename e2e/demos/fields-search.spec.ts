import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-search";

test.describe("demo: fields search", () => {
  test("records field search with parameter and persona filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/management/fields",
      toolbar: "fields-toolbar",
      surface: "fields-grid",
      search: "fields-search",
      query: "Confused",
      card: /^field-card-/,
    });
    await saveDemoVideo(page, TOPIC);
  });
});
