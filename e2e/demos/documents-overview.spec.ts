import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";

test.describe("demo: documents overview", () => {
  test("browse the documents library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "document");
  });
});
