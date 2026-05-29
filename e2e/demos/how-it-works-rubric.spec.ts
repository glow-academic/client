import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";

test.describe("demo: how-it-works rubric", () => {
  test("tour a graded attempt's rubric scorecard", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await attemptDemo({ page, demo, registry, request, runId }, "how-it-works-rubric", [
      /score|passed|rubric|standard|feedback/i,
    ]);
  });
});
