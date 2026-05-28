import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: parameters create", () => {
  test("instructor builds a parameter", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "parameter", {
      name: `Student Age ${runId}`,
      description: "The learner's age band, used to tune scenario difficulty.",
    });
  });
});
