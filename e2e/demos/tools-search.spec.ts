import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-search";

test.describe("demo: tools search", () => {
  test("records tool search and agent/creatable filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/intelligence/tools",
      toolbar: "tools-toolbar",
      surface: "tools-grid",
      search: "tools-search",
      query: "policy",
      card: "tool-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
