import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";
test.describe("demo: how-it-works attempt loop", () => {
  test("tour the multi-turn conversation", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await attemptDemo({ page, demo, registry, request, runId }, "how-it-works-attempt-loop",
      [/message|reply|assistant|user/i, /score|complete|feedback/i]);
  });
});
