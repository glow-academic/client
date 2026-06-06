import { test } from "../fixtures";
import { attemptDemo } from "../helpers/crud-demos";
test.describe("demo: how-it-works attempt loop", () => {
  test("tour the multi-turn conversation", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    // AUDIT FIX: feature a TYPICAL (median-score) attempt, not the highest —
    // `annotated-example-excellent` already replays the best attempt, so both
    // demos resolving "best" produced near-identical clips. Median lands on a
    // distinct seeded attempt so the two recordings show different content.
    await attemptDemo({ page, demo, registry, request, runId }, "how-it-works-attempt-loop",
      [/message|reply|assistant|user/i, /score|complete|feedback/i], "median");
  });
});
