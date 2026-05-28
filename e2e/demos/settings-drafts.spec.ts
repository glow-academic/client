// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-drafts";

test.describe("demo: settings drafts", () => {
  test("records a staged settings draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/settings/new");
    await page.getByPlaceholder(/university settings/i).fill("CS Department Config");
    await showFormStep(page, "basic");
    await scrollToText(page, /draft|create setting|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});