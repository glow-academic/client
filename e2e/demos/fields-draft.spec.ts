import { test } from "../fixtures";
import { draftDemo } from "../helpers/crud-demos";

test.describe("demo: fields draft", () => {
  test("save a field as a draft", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await draftDemo({ page, demo, registry, request, runId }, "field");
  });
});
