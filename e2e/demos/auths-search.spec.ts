import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: auths search", () => {
  test("search the auths library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "auth");
  });
});
