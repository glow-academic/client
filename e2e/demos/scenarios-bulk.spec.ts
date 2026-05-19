import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-bulk";

test.describe("demo: scenarios bulk", () => {
  test("records scenario grid bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/training/scenarios",
      toolbar: "scenarios-toolbar",
      surface: "scenarios-grid",
      card: "scenario-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
