import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-draft";

test.describe("demo: personas draft", () => {
  test("records the draft toolbar while staging persona edits", async ({ page }) => {
    await openArtifactForm(page, "/training/personas/new");
    await page.getByPlaceholder(/enthusiastic student/i).fill("Draft Demo Persona");
    await page.getByTestId("input-persona-description").fill("Drafted description before publish.");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
