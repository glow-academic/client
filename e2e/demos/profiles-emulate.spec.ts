import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-emulate";

test.describe("demo: profiles emulate", () => {
  test("records the profile action area where admins can emulate users", async ({ page }) => {
    await openLibrary(page, "/management/profiles", "profiles-toolbar", "profiles-table");
    await hoverFirstVisible(page, "profiles-row");
    await scrollToText(page, /emulate|unemulate|preview|edit/i);
    await saveDemoVideo(page, TOPIC);
  });
});
