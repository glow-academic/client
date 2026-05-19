import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-create";

test.describe("demo: profiles create", () => {
  test("records name, email, department, and role setup", async ({ page }) => {
    await openArtifactForm(page, "/management/profiles/new");
    await page.getByPlaceholder(/jane doe/i).fill("TA Johnson");
    await showFormStep(page, "contact");
    await page.getByPlaceholder(/type primary email/i).fill("johnson@university.edu");
    await showFormStep(page, "roles");
    await saveDemoVideo(page, TOPIC);
  });
});
