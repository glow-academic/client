import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "auths-oidc";

test.describe("demo: auths oidc", () => {
  test("records protocol, slug, and encrypted item wiring", async ({ page }) => {
    await openArtifactForm(page, "/platform/auth/new");
    await page.getByPlaceholder(/production api key/i).fill("OIDC Demo Provider");
    await showFormStep(page, "protocols");
    await scrollToText(page, /oidc|saml|protocol/i);
    await showFormStep(page, "slugs");
    await scrollToText(page, /slug|login/i);
    await showFormStep(page, "items");
    await saveDemoVideo(page, TOPIC);
  });
});