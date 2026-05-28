import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: agents search", () => {
  test("search the agents library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "agent");
  });
});
