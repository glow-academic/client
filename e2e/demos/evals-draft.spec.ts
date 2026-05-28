import { test } from "../fixtures";
import { draftDemo } from "../helpers/crud-demos";

test.describe("demo: evals draft", () => {
  test("save a eval as a draft", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await draftDemo({ page, demo, registry, request, runId }, "eval");
  });
});
