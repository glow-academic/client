import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-bulk";

test.describe("demo: departments bulk", () => {
  test("records department selection and all-matching bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/platform/departments",
      toolbar: "departments-toolbar",
      surface: "departments-grid",
      card: "department-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
