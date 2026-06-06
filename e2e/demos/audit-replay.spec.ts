import { test } from "../fixtures";
import { genDemo } from "../helpers/crud-demos";
test.describe("demo: audit replay", () => {
  test("safe-mode generation: soft-stage tool calls, then accept (audit path)", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(150_000);
    await genDemo({ page, demo, registry, request, runId }, "audit-replay",
      "Create a new persona named 'Clarifier' whose defining trait is asking one brief clarifying question before answering.",
      { safeMode: true });
  });
});
