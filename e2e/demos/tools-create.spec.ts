import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: tools create", () => {
  test("instructor builds a tool", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "tool", {
      name: `Calculator ${runId}`,
      description: "Evaluates arithmetic expressions and returns the result.",
    });
  });
});
