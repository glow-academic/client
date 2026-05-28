import { test } from "../fixtures";
import { draftDemo } from "../helpers/crud-demos";

test.describe("demo: tools draft", () => {
  test("save a tool as a draft", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await draftDemo({ page, demo, registry, request, runId }, "tool");
  });
});
