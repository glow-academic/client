import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-overview";

test.describe("demo: cohorts overview", () => {
  test("records the cohort cards with membership and simulation context", async ({ page }) => {
    await openLibrary(page, "/training/cohorts", "cohorts-toolbar", "cohorts-grid");
    await hoverFirstVisible(page, "cohort-card");
    await scrollToText(page, /profiles|simulations|departments|members/i);
    await saveDemoVideo(page, TOPIC);
  });
});
