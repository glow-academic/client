import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-overview";

test.describe("demo: personas overview", () => {
  test("records persona cards and drill-in controls", async ({ page }) => {
    await openLibrary(page, "/training/personas", "personas-toolbar", "personas-grid");
    await hoverFirstVisible(page, "persona-card");
    await scrollToText(page, /voice|department|scenario|instructions/i);
    await saveDemoVideo(page, TOPIC);
  });
});
