import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-search";

test.describe("demo: simulations search", () => {
  test("records simulation search and scenario facets", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/training/simulations",
      toolbar: "simulations-toolbar",
      surface: "simulations-grid",
      search: "simulations-search",
      query: "training",
      card: "simulation-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
