import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-bulk";

test.describe("demo: profiles bulk", () => {
  test("records profile selection and bulk-operation affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/management/profiles",
      toolbar: "profiles-toolbar",
      surface: "profiles-table",
      card: "profiles-row",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
