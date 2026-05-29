import { test } from "../fixtures";
import { detailDemo } from "../helpers/crud-demos";

test.describe("demo: parameters resolve", () => {
  test("tour a parameter's fields", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(120_000);
    await detailDemo({ page, demo, registry, request, runId }, "parameter", "parameters-resolve", [
      /fields|select fields/i, /description|department/i,
    ]);
  });
});
