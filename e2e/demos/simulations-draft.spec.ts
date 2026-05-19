import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-draft";

test.describe("demo: simulations draft", () => {
  test("records draft controls for simulation edits", async ({ page }) => {
    await openArtifactForm(page, "/training/simulations/new");
    await page.getByPlaceholder(/simulation name/i).fill("Draft Simulation Demo");
    await expect(page.getByTestId("draft-toolbar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("artifact-form-submit")).toBeVisible();
    await saveDemoVideo(page, TOPIC);
  });
});
