import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: simulations search", () => {
  test("search the simulations library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "simulation");
  });
});
