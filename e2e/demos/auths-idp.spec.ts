// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-idp";

test.describe("demo: auths idp", () => {
  test("records greenfield IdP onboarding sections", async ({ page }) => {
    await openArtifactForm(page, "/platform/auth/new");
    await page.getByPlaceholder(/production api key/i).fill("Acme University SSO");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("Greenfield OIDC provider configuration for Acme.");
    await showFormStep(page, "protocols");
    await showFormStep(page, "slugs");
    await showFormStep(page, "items");
    await scrollToText(page, /auth item name|client|secret|encrypted/i);
    await saveDemoVideo(page, TOPIC);
  });
});