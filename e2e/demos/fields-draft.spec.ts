import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-draft";

test.describe("demo: fields draft", () => {
  test("records a staged field draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/management/fields/new");
    await page.getByPlaceholder(/learning style/i).fill("Draft Demo Field");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("Draft changes to field metadata are staged before publishing.");
    await scrollToText(page, /draft|create field|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
