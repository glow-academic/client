import { test } from "@playwright/test";
import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: permissions overview", () => {
  test("the role + permission catalog on profile setup", async ({ page }) => {
    test.setTimeout(120_000);
    await openArtifactForm(page, "/management/profiles/new");
    await showFormStep(page, "roles");
    await pauseForDemo();
    const roleName = page.getByPlaceholder(/role name/i);
    if (await roleName.isVisible().catch(() => false)) await roleName.fill("Teaching Assistant");
    await scrollToText(page, /permission|role|access|limit|artifact/i);
    await saveDemoVideo(page, "permissions-overview");
  });
});
