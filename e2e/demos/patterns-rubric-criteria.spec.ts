import { test } from "../fixtures";
import { detailDemo } from "../helpers/crud-demos";

test.describe("demo: patterns rubric criteria", () => {
  test("tour a rubric's standards and pass threshold", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await detailDemo({ page, demo, registry, request, runId }, "rubric", "patterns-rubric-criteria", [
      /pass points|total points|threshold/i, /standard|group|criteria/i,
    ]);
  });
});
