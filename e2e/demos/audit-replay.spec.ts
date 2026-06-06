import { test } from "../fixtures";
import { genDemo } from "../helpers/crud-demos";
test.describe("demo: audit replay", () => {
  test("safe-mode generation: soft-stage tool calls, then accept (audit path)", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(150_000);
    await genDemo({ page, demo, registry, request, runId }, "audit-replay",
      "Create a new persona. Set only its name to 'Clarifier' and its description to 'Asks one brief clarifying question before answering.' Do not set any color, department, voice, flag, or parameter field.",
      { safeMode: true });
  });
});
