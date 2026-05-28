// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-provider-keys";

test.describe("demo: settings provider keys", () => {
  test("records provider selection and encrypted key management", async ({ page }) => {
    await openArtifactForm(page, "/settings/new");
    await page.getByPlaceholder(/university settings/i).fill("Provider Key Demo Settings");
    await showFormStep(page, "provider");
    await scrollToText(page, /providers|provider keys|reveal|encrypted/i);
    await saveDemoVideo(page, TOPIC);
  });
});