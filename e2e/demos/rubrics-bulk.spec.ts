import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-bulk";

test.describe("demo: rubrics bulk", () => {
  test("records rubric bulk-operation affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/platform/rubrics",
      toolbar: "rubrics-toolbar",
      surface: "rubrics-grid",
      card: "rubric-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
