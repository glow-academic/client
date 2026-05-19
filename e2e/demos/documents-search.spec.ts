import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-search";

test.describe("demo: documents search", () => {
  test("records document search with scenario, field, and department filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/management/documents",
      toolbar: "documents-toolbar",
      surface: "documents-table",
      search: "documents-search",
      query: "FERPA",
      card: "documents-row",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
