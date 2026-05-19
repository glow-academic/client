import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-create";

test.describe("demo: simulations create", () => {
  test("records the basic simulation creation form", async ({ page }) => {
    await openArtifactForm(page, "/training/simulations/new");
    await page.getByPlaceholder(/simulation name/i).fill("Academic Integrity Training Demo");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
