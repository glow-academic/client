import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-bulk";

test.describe("demo: documents bulk", () => {
  test("records document selection and all-matching bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/management/documents",
      toolbar: "documents-toolbar",
      surface: "documents-table",
      card: "documents-row",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
