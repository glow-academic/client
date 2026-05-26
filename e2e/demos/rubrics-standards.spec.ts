import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-standards";

test.describe("demo: rubrics standards", () => {
  test("records standard groups and standards sections", async ({ page }) => {
    await openArtifactForm(page, "/platform/rubrics/new");
    await showFormStep(page, "standard_groups");
    await scrollToText(page, /active listening|empathy|clarity|standard/i);
    await showFormStep(page, "standards");
    await saveDemoVideo(page, TOPIC);
  });
});
