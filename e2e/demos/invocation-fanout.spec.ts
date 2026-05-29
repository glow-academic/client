import { test } from "../fixtures";
import { testDemo } from "../helpers/crud-demos";
test.describe("demo: invocation fanout", () => {
  test("tour a test's invocation grid", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await testDemo({ page, demo, registry, request, runId }, "invocation-fanout",
      [/invocation|scenario|model|agent/i, /status|queued|running|completed|score/i]);
  });
});
