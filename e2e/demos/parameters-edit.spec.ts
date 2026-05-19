import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-edit";

test.describe("demo: parameters edit", () => {
  test("records field membership editing for a parameter", async ({ page }) => {
    await openArtifactForm(page, "/management/parameters/new");
    await page.getByPlaceholder(/student age/i).fill("Class");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("Course context values such as CS-180, CS-251, and CS-307.");
    await showFormStep(page, "fields");
    await scrollToText(page, /search fields|show selected|fields/i);
    await saveDemoVideo(page, TOPIC);
  });
});
