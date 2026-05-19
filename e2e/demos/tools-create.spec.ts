import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-create";

test.describe("demo: tools create", () => {
  test("records the basic tool definition form", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/tools/new");
    await page.getByPlaceholder(/calculator/i).fill("lookup_course_policy");
    await showFormStep(page, "basic");
    await saveDemoVideo(page, TOPIC);
  });
});
