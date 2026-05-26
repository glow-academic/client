// Profile — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: profiles", () => {
  test("instructor builds a profile", async ({ profiles, runId, page }) => {
    const name = `Jordan Lee ${runId}`;

    await profiles.create({ name });

    await profiles.open();
    await profiles.search(name);
    await profiles.library.expectVisible(name);

    await saveDemoVideo(page, "profiles-create-story");
  });
});
