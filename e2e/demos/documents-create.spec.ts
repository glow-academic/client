import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "documents-create";

test.describe("demo: documents create", () => {
  test("records document metadata, fields, and content sections", async ({ page }) => {
    await openArtifactForm(page, "/management/documents/new");
    await page.getByPlaceholder(/course syllabus/i).fill("Academic Integrity Policy");
    await page
      .getByTestId("input-document-description")
      .fill("University policy on academic honesty, plagiarism, and cheating.");
    await showFormStep(page, "fields");
    await scrollToText(page, /parameters|fields|selected/i);
    await showFormStep(page, "texts");
    await saveDemoVideo(page, TOPIC);
  });
});
