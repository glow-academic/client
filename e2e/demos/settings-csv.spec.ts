import { expect, test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-csv";

test.describe("demo: settings csv", () => {
  test("records the settings CSV import entry point and upload preview shell", async ({ page }) => {
    await openLibrary(page, "/settings", "settings-toolbar", "settings-grid");
    const importButton = page.getByRole("button", { name: /import csv/i });
    if (await importButton.isVisible().catch(() => false)) {
      await importButton.click();
      await expect(page.getByText(/import settings from csv/i)).toBeVisible({ timeout: 10_000 });
      await scrollToText(page, /drop a \.csv file|download template|required/i);
    } else {
      await scrollToText(page, /import csv|export|settings/i);
    }
    await pauseForDemo();
    await saveDemoVideo(page, TOPIC);
  });
});
