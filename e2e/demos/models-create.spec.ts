import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: models create", () => {
  test("instructor builds a model", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "model", {
      name: `Aurora ${runId}`,
      description: "A general-purpose chat model for tutoring scenarios.",
      value: `aurora-${runId}`,
    });
  });
});
