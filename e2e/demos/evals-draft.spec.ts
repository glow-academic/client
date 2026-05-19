import { test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-draft";

test.describe("demo: evals draft", () => {
  test("records a staged eval draft before publish", async ({ page }) => {
    await openArtifactForm(page, "/system/evals/new");
    await page.getByPlaceholder(/eval name/i).fill("Draft Demo Eval");
    await page
      .getByPlaceholder(/enter description/i)
      .fill("Draft eval scoring changes are staged before affecting runs.");
    await scrollToText(page, /draft|create eval|save/i);
    await saveDemoVideo(page, TOPIC);
  });
});
