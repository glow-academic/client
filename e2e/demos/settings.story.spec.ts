// Setting — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: settings", () => {
  test("instructor builds a setting", async ({ settings, runId, page }) => {
    const name = `University Settings ${runId}`;

    await settings.create({
      name,
      description: "Tenant-wide configuration for the university workspace.",
    });

    await settings.open();
    await settings.search(name);
    await settings.library.expectVisible(name);

    await saveDemoVideo(page, "settings-create-story");
  });
});
