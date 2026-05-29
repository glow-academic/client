import { test } from "../fixtures";
import { genDemo } from "../helpers/crud-demos";
test.describe("demo: audit replay", () => {
  test("safe-mode generation: soft-stage tool calls, then accept (audit path)", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(150_000);
    await genDemo({ page, demo, registry, request, runId }, "audit-replay",
      "Add a brief clarifying-questions trait to a new persona.", { safeMode: true });
  });
});
