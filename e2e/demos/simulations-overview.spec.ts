import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-overview";

test.describe("demo: simulations overview", () => {
  test("records simulation cards with scenario and cohort context", async ({ page }) => {
    await openLibrary(page, "/training/simulations", "simulations-toolbar", "simulations-grid");
    await hoverFirstVisible(page, "simulation-card");
    await scrollToText(page, /scenario|cohort|practice|active/i);
    await saveDemoVideo(page, TOPIC);
  });
});
