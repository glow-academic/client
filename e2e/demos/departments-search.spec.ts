import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-search";

test.describe("demo: departments search", () => {
  test("records department search and drill-in affordances", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/system/departments",
      toolbar: "departments-toolbar",
      surface: "departments-grid",
      search: "departments-search",
      query: "University",
      card: "department-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
