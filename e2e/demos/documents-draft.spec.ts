import { test } from "../fixtures";
import { draftDemo } from "../helpers/crud-demos";

test.describe("demo: documents draft", () => {
  test("save a document as a draft", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await draftDemo({ page, demo, registry, request, runId }, "document");
  });
});
