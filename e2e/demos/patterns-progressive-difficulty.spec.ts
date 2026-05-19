import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-progressive-difficulty";

test.describe("demo: patterns progressive difficulty", () => {
  test("records scenario ordering inside a simulation draft", async ({ page }) => {
    await openArtifactForm(page, "/training/simulations/new");
    await page.getByPlaceholder(/simulation name/i).fill("TA Office Hours Training");
    await showFormStep(page, "scenarios");
    await scrollToText(page, /scenario positions|time limits|search scenarios|show selected/i);
    await saveDemoVideo(page, TOPIC);
  });
});
