import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-bulk";

test.describe("demo: parameters bulk", () => {
  test("records parameter selection and all-matching bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/management/parameters",
      toolbar: "parameters-toolbar",
      surface: "parameters-grid",
      card: "parameter-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
