// Parameter — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: parameters", () => {
  test("instructor builds a parameter", async ({ parameters, runId, page }) => {
    const name = `Student Age ${runId}`;

    await parameters.create({
      name,
      description: "The learner's age band, used to tune scenario difficulty.",
    });

    await parameters.open();
    await parameters.search(name);
    await parameters.library.expectVisible(name);

    await saveDemoVideo(page, "parameters-create-story");
  });
});
