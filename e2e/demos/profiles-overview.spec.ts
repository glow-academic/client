import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-overview";

test.describe("demo: profiles overview", () => {
  test("records the profiles table with role and department context", async ({ page }) => {
    await openLibrary(page, "/management/profiles", "profiles-toolbar", "profiles-table");
    await hoverFirstVisible(page, "profiles-row");
    await scrollToText(page, /role|department|last login|email/i);
    await saveDemoVideo(page, TOPIC);
  });
});
