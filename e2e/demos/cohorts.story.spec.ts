// Cohort — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: cohorts", () => {
  test("instructor builds a cohort", async ({ cohorts, runId, page }) => {
    const name = `Spring Cohort ${runId}`;

    await cohorts.create({
      name,
      description:
        "First-year students in the spring intake — paired with intro simulations.",
    });

    await cohorts.open();
    await cohorts.search(name);
    await cohorts.library.expectVisible(name);

    await saveDemoVideo(page, "cohorts-create-story");
  });
});
