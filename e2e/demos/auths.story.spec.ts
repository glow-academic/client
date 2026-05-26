// Auth — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: auths", () => {
  test("instructor builds an auth", async ({ auths, runId, page }) => {
    const name = `Production API Key ${runId}`;

    await auths.create({
      name,
      description: "Credentials for the production inference gateway.",
    });

    await auths.open();
    await auths.library.expectVisible(name);

    await saveDemoVideo(page, "auths-create-story");
  });
});
