import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-draft";

test.describe("demo: auths draft", () => {
  test("records a staged auth draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/system/auth/new");
    await page.getByPlaceholder(/production api key/i).fill("Draft Demo Auth");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("Draft auth configuration is staged before identity-provider sync.");
    await scrollToText(page, /draft|create auth|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
