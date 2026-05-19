import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-simulation";

test.describe("demo: tutorial simulation", () => {
  test("records bundling scenarios into an ordered simulation", async ({ page }) => {
    await openArtifactForm(page, "/training/simulations/new");
    await page.getByPlaceholder(/simulation name/i).fill("TA Office Hours Training");
    await showFormStep(page, "scenarios");
    await scrollToText(page, /scenario positions|scenario time limits|search scenarios/i);
    await saveDemoVideo(page, TOPIC);
  });
});
