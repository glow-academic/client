import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-edit";

test.describe("demo: simulations edit", () => {
  test("records scenario ordering, rubrics, and time-limit configuration", async ({ page }) => {
    await openArtifactForm(page, "/training/simulations/new");
    await showFormStep(page, "scenarios");
    await scrollToText(page, /rubric|time limit|position|scenario/i);
    await saveDemoVideo(page, TOPIC);
  });
});
