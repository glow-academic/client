import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";
test.describe("demo: annotated-example overview", () => {
  test("a graded attempt with its scorecard", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await attemptDemo({ page, demo, registry, request, runId }, "annotated-example-overview",
      [/score|passed|rubric/i, /feedback|standard/i]);
  });
});
