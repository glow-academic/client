import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-bulk";

test.describe("demo: models bulk", () => {
  test("records model bulk-operation affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/intelligence/models",
      toolbar: "models-toolbar",
      surface: "models-grid",
      card: "model-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
