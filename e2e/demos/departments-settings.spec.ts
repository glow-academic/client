import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-settings";

test.describe("demo: departments settings", () => {
  test("records the department-level settings and flags section", async ({ page }) => {
    await openArtifactForm(page, "/system/departments/new");
    await page.getByPlaceholder(/customer success/i).fill("University");
    await showFormStep(page, "settings");
    await scrollToText(page, /settings|flags|show selected/i);
    await saveDemoVideo(page, TOPIC);
  });
});
