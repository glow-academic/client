// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-examples";

test.describe("demo: personas examples", () => {
  test("records where example dialogue teaches voice", async ({ page }) => {
    await openArtifactForm(page, "/training/personas/new");
    await showFormStep(page, "content");
    await page.getByTestId("input-instructions").fill(
      "Always start with 'Uh...' and avoid direct answers until pressed for specifics.",
    );
    await scrollToText(page, /examples?|dialogue|voice/i);
    await saveDemoVideo(page, TOPIC);
  });
});