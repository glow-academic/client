import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-bulk";

test.describe("demo: providers bulk", () => {
  test("records provider bulk-operation affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/intelligence/providers",
      toolbar: "providers-toolbar",
      surface: "providers-toolbar",
      card: "provider-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
