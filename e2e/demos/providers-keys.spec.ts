// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "providers-keys";

test.describe("demo: providers keys", () => {
  test("records encrypted key management surfaces without decrypting", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/providers/new");
    await showFormStep(page, "key");
    await scrollToText(page, /key|encrypted|decrypt|credential/i);
    await saveDemoVideo(page, TOPIC);
  });
});