import { test } from "@playwright/test";

import { recordSearchControls } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-search";

test.describe("demo: providers search", () => {
  test("records provider search and department/model filters", async ({ page }) => {
    await recordSearchControls(page, {
      path: "/intelligence/providers",
      toolbar: "providers-toolbar",
      surface: "providers-toolbar",
      search: "input-search-providers",
      query: "openai",
      card: "provider-card",
    });
    await saveDemoVideo(page, TOPIC);
  });
});
