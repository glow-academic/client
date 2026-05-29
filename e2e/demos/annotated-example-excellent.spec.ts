import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";
test.describe("demo: annotated-example excellent", () => {
  test("replay the highest-scoring attempt", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await attemptDemo({ page, demo, registry, request, runId }, "annotated-example-excellent",
      [/message|reply/i, /score|passed|feedback|rubric/i]);
  });
});
