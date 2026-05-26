import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-create";

test.describe("demo: auths create", () => {
  test("records auth provider shell creation", async ({ page }) => {
    await openArtifactForm(page, "/platform/auth/new");
    await page.getByPlaceholder(/production api key/i).fill("University SSO");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("OIDC login for university faculty and TAs.");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
