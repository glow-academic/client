import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: fields create", () => {
  test("instructor builds a field", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "field", {
      name: `Learning Style ${runId}`,
      description: "How the learner prefers to absorb material.",
    });
  });
});
