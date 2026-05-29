import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";
test.describe("demo: how-it-works overview", () => {
  test("walk a completed attempt end-to-end", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await attemptDemo({ page, demo, registry, request, runId }, "how-it-works-overview",
      [/persona|scenario|message/i, /score|passed|rubric/i]);
  });
});
