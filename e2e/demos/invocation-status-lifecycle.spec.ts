import { test } from "../fixtures";
import { testDemo } from "../helpers/crud-demos";
test.describe("demo: invocation status-lifecycle", () => {
  test("invocation statuses on a test's detail page", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await testDemo({ page, demo, registry, request, runId }, "invocation-status-lifecycle",
      [/queued|running|completed|failed|status/i, /invocation|model|scenario|score/i]);
  });
});
