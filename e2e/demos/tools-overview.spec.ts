import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-overview";

test.describe("demo: tools overview", () => {
  test("records tool cards with agent and argument context", async ({ page }) => {
    await openLibrary(page, "/intelligence/tools", "tools-toolbar", "tools-grid");
    await hoverFirstVisible(page, "tool-card");
    await scrollToText(page, /agent|argument|creatable|permission/i);
    await saveDemoVideo(page, TOPIC);
  });
});
