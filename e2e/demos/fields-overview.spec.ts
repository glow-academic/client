import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";

test.describe("demo: fields overview", () => {
  test("browse the fields library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "field");
  });
});
