import { test } from "../fixtures";
import { editDemo } from "../helpers/crud-demos";

test.describe("demo: cohorts edit", () => {
  test("edit a cohort", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await editDemo({ page, demo, registry, request, runId }, "cohort");
  });
});
