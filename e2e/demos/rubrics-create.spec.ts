import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: rubrics create", () => {
  test("instructor builds a rubric", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "rubric", {
      name: `Sales Call Rubric ${runId}`,
      description: "Scores how a rep handles a discovery call.",
      passPoints: "12",
    });
  });
});
