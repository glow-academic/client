import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-edit";

test.describe("demo: profiles edit", () => {
  test("records the editable role, department, and request-limit areas", async ({ page }) => {
    await openArtifactForm(page, "/management/profiles/new");
    await page.getByPlaceholder(/jane doe/i).fill("Professor Smith");
    await showFormStep(page, "basic");
    await scrollToText(page, /departments|flags/i);
    await showFormStep(page, "roles");
    await scrollToText(page, /instructional staff|administrator|super administrator|request limit/i);
    await saveDemoVideo(page, TOPIC);
  });
});
