import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-draft";

test.describe("demo: cohorts draft", () => {
  test("records a staged cohort draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/training/cohorts/new");
    await page.getByPlaceholder(/spring 2024 cohort/i).fill("Draft Demo Cohort");
    await page
      .getByPlaceholder(/detailed description of the cohort/i)
      .fill("Draft changes to cohort composition are staged before publishing.");
    await scrollToText(page, /draft|create cohort|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
