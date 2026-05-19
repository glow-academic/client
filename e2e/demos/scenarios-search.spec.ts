import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-search";

test.describe("demo: scenarios search", () => {
  test("records scenario search and persona/document facets", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/training/scenarios",
      toolbar: "scenarios-toolbar",
      surface: "scenarios-grid",
      search: "scenarios-search",
      query: "FERPA",
      card: "scenario-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
