import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-draft";

test.describe("demo: departments draft", () => {
  test("records a staged department draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/system/departments/new");
    await page.getByPlaceholder(/customer success/i).fill("Draft Demo Department");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("Draft changes to department scope are staged before publishing.");
    await scrollToText(page, /draft|create department|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
