import { test } from "@playwright/test";

import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "personas-create";

test.describe("demo: personas create", () => {
  test("records name, description, color, icon, and instructions setup", async ({ page }) => {
    await openArtifactForm(page, "/training/personas/new");
    await page.getByPlaceholder(/enthusiastic student/i).fill("Confused Demo Student");
    await page.getByTestId("input-persona-description").fill(
      "A student who asks clarifying questions and gets frustrated when answers skip steps.",
    );
    await showFormStep(page, "color");
    await showFormStep(page, "icon");
    await showFormStep(page, "content");
    await page.getByTestId("input-instructions").fill(
      "You are a confused student in {{class}}. Ask clarifying questions and use short, uncertain replies.",
    );
    await saveDemoVideo(page, TOPIC);
  });
});
