import { test } from "../fixtures";
import { bulkDeleteDemo } from "../helpers/crud-demos";

test.describe("demo: providers bulk", () => {
  test("bulk-delete providers", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await bulkDeleteDemo({ page, demo, registry, request, runId }, "provider");
  });
});
