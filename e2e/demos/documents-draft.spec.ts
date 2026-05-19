import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-draft";

test.describe("demo: documents draft", () => {
  test("records a staged document draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/management/documents/new");
    await page.getByPlaceholder(/course syllabus/i).fill("Draft Demo Document");
    await page
      .getByTestId("input-document-description")
      .fill("Draft document metadata is staged before publishing.");
    await scrollToText(page, /draft|create document|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
