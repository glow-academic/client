import { test } from "../fixtures";
import { detailDemo } from "../helpers/crud-demos";

test.describe("demo: patterns persona realism", () => {
  test("tour a persona's instructions and examples", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await detailDemo({ page, demo, registry, request, runId }, "persona", "patterns-persona-realism", [
      /instructions/i, /example|message/i, /voice|personality/i,
    ]);
  });
});
