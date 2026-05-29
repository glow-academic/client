import { test } from "@playwright/test";
import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: permissions client-mirror", () => {
  test("per-artifact permission toggles mirrored in the client", async ({ page }) => {
    test.setTimeout(120_000);
    await openArtifactForm(page, "/management/profiles/new");
    await showFormStep(page, "roles");
    await pauseForDemo();
    await scrollToText(page, /persona|scenario|rubric|simulation|read|write|manage/i);
    await scrollToText(page, /permission|access|limit/i);
    await saveDemoVideo(page, "permissions-client-mirror");
  });
});
