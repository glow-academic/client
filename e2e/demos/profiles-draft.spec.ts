import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-draft";

test.describe("demo: profiles draft", () => {
  test("records a staged profile draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/management/profiles/new");
    await page.getByPlaceholder(/jane doe/i).fill("Draft Demo Profile");
    await showFormStep(page, "contact");
    await page.getByPlaceholder(/type primary email/i).fill("draft-profile@university.edu");
    await scrollToText(page, /draft|create profile|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
