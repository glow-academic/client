import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-edit";

test.describe("demo: fields edit", () => {
  test("records conditional parameter wiring for a field", async ({ page }) => {
    await openArtifactForm(page, "/management/fields/new");
    await page.getByPlaceholder(/learning style/i).fill("CS-180");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("Introductory computer science course field.");
    await showFormStep(page, "conditional");
    await scrollToText(page, /conditional parameters|search conditional parameters|show selected/i);
    await saveDemoVideo(page, TOPIC);
  });
});
