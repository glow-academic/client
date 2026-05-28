import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: evals create", () => {
  test("instructor builds an eval", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "eval", {
      name: `Tutor Quality Eval ${runId}`,
      description: "Scores tutoring responses against the quality rubric.",
    });
  });
});
