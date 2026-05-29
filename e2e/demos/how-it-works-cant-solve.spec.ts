import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";
test.describe("demo: how-it-works cant-solve", () => {
  test("a stalled, low-scoring attempt where vague input fails to progress", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await attemptDemo({ page, demo, registry, request, runId }, "how-it-works-cant-solve",
      [/message|reply|persona/i, /score|incomplete|not passed|feedback/i], "worst");
  });
});
