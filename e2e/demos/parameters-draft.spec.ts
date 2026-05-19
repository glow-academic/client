import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-draft";

test.describe("demo: parameters draft", () => {
  test("records a staged parameter draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/management/parameters/new");
    await page.getByPlaceholder(/student age/i).fill("Draft Demo Parameter");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("Draft parameter changes are staged before publishing.");
    await scrollToText(page, /draft|create parameter|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
