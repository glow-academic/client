import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-search";

test.describe("demo: cohorts search", () => {
  test("records cohort search with profile, simulation, and department filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/training/cohorts",
      toolbar: "cohorts-toolbar",
      surface: "cohorts-grid",
      search: "cohorts-search",
      query: "Practice",
      card: "cohort-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
