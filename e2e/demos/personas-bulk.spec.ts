import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-bulk";

test.describe("demo: personas bulk", () => {
  test("records selectable persona grid and bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/training/personas",
      toolbar: "personas-toolbar",
      surface: "personas-grid",
      card: "persona-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
