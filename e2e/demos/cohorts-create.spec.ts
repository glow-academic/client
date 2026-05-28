import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: cohorts create", () => {
  test("instructor builds a cohort", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "cohort", {
      name: `Spring Intake ${runId}`,
      description:
        "First-year students in the spring intake — paired with intro simulations.",
    });
  });
});
