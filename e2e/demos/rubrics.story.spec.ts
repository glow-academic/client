// Rubric — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: rubrics", () => {
  test("instructor builds a rubric", async ({ rubrics, runId, page }) => {
    const name = `Sales Call Rubric ${runId}`;

    await rubrics.create({
      name,
      description: "Scores how a rep handles a discovery call.",
      passPoints: "12",
    });

    await rubrics.open();
    await rubrics.search(name);
    await rubrics.library.expectVisible(name);

    await saveDemoVideo(page, "rubrics-create-story");
  });
});
