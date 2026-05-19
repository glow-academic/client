import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-bulk";

test.describe("demo: fields bulk", () => {
  test("records field selection and all-matching bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/management/fields",
      toolbar: "fields-toolbar",
      surface: "fields-grid",
      card: /^field-card-/,
    });
    await saveDemoVideo(page, TOPIC);
  });
});
