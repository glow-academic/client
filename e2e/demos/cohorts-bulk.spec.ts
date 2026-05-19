import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-bulk";

test.describe("demo: cohorts bulk", () => {
  test("records cohort selection and all-matching bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/training/cohorts",
      toolbar: "cohorts-toolbar",
      surface: "cohorts-grid",
      card: "cohort-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
