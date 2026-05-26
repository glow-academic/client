import { test } from "@playwright/test";

import { recordBulkAffordances } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-bulk";

test.describe("demo: evals bulk", () => {
  test("records eval selection and all-matching bulk affordances", async ({ page }) => {
    await recordBulkAffordances(page, {
      path: "/platform/evals",
      toolbar: "evals-toolbar",
      surface: "evals-grid",
      card: "eval-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
