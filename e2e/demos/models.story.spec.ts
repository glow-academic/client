// Model — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: models", () => {
  test("instructor builds a model", async ({ models, runId, page }) => {
    const name = `Aurora ${runId}`;

    await models.create({
      name,
      description: "A general-purpose chat model for tutoring scenarios.",
      value: `aurora-${runId}`,
    });

    await models.open();
    await models.search(name);
    await models.library.expectVisible(name);

    await saveDemoVideo(page, "models-create-story");
  });
});
