import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-bulk";

test.describe("demo: tools bulk", () => {
  test("records tool bulk-operation affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/intelligence/tools",
      toolbar: "tools-toolbar",
      surface: "tools-grid",
      card: "tool-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
