import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-bulk-write";

test.describe("demo: patterns bulk write", () => {
  test("records the canonical all-matching bulk-write UI", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/training/personas",
      toolbar: "personas-toolbar",
      surface: "personas-grid",
      card: "persona-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});