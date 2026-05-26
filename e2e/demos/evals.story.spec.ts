// Eval — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: evals", () => {
  test("instructor builds an eval", async ({ evals, runId, page }) => {
    const name = `Tutor Quality Eval ${runId}`;

    await evals.create({
      name,
      description: "Scores tutoring responses against the quality rubric.",
    });

    await evals.open();
    await evals.search(name);
    await evals.library.expectVisible(name);

    await saveDemoVideo(page, "evals-create-story");
  });
});
