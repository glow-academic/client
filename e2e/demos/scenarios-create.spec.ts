import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-create";

test.describe("demo: scenarios create", () => {
  test("records name, description, problem, and objectives setup", async ({ page }) => {
    await openArtifactForm(page, "/training/scenarios/new");
    await page.getByPlaceholder(/customer support escalation/i).fill("Academic Integrity Demo");
    await page.getByPlaceholder(/describe the scenario/i).fill(
      "Practice handling a student caught cheating while maintaining a professional tone.",
    );
    await scrollToText(page, /problem statement|objectives|personas/i);
    await saveDemoVideo(page, TOPIC);
  });
});
