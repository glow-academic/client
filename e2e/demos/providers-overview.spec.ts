import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-overview";

test.describe("demo: providers overview", () => {
  test("records provider cards with endpoint, model, and key context", async ({ page }) => {
    await openLibrary(page, "/intelligence/providers", "providers-toolbar", "providers-toolbar");
    await hoverFirstVisible(page, "provider-card");
    await scrollToText(page, /endpoint|model|key|department/i);
    await saveDemoVideo(page, TOPIC);
  });
});
