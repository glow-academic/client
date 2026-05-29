import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-drafts";

test.describe("demo: patterns drafts", () => {
  test("records the common draft toolbar and staged-edit pattern", async ({ page }) => {
    await openArtifactForm(page, "/training/personas/new");
    await page.getByPlaceholder(/enthusiastic student/i).fill("Draft Pattern Persona");
    await scrollToText(page, /draft|create persona|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});