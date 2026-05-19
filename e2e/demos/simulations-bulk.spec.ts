import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-bulk";

test.describe("demo: simulations bulk", () => {
  test("records simulation bulk-operation affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/training/simulations",
      toolbar: "simulations-toolbar",
      surface: "simulations-grid",
      card: "simulation-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
