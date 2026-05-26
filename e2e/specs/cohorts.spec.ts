// Cohorts — correctness suite. Name is the only required field; simulations
// and profiles are optional cross-entity enrichments (best-effort).

import { test, expect } from "../fixtures";

test.describe("cohorts", () => {
  test("an instructor creates a cohort and sees it in the library", async ({
    cohorts,
    runId,
  }) => {
    const name = `Spring Cohort ${runId}`;

    await cohorts.create({
      name,
      description: "First-year students in the spring intake.",
    });

    await cohorts.open();
    await cohorts.search(name);
    await expect(cohorts.card(name)).toBeVisible();
  });
});
