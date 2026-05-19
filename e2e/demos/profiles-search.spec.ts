import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-search";

test.describe("demo: profiles search", () => {
  test("records profile search with role and department filters nearby", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/management/profiles",
      toolbar: "profiles-toolbar",
      surface: "profiles-table",
      search: "profiles-search",
      query: "Johnson",
      card: "profiles-row",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
