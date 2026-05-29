import { expect, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-wiring";

test.describe("demo: agents wiring", () => {
  test("records model, tool, and rubric wiring sections", async ({ page }) => {
    await openArtifactForm(page, "/intelligence/agents/new");
    await page.getByPlaceholder(/customer support agent/i).fill("Support Agent");
    await scrollToText(page, /^Tools$/i);
    await scrollToText(page, /^Model$/i);
    await scrollToText(page, /^Rubrics?$/i);
    await scrollToText(page, /^Prompt/i);
    await saveDemoVideo(page, TOPIC);
  });
});
