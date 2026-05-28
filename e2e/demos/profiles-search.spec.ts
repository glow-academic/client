import { test } from "../fixtures";
import { searchDemo } from "../helpers/crud-demos";

test.describe("demo: profiles search", () => {
  test("search the profiles library", async ({ page, demo, registry, request, runId }) => {
    await searchDemo({ page, demo, registry, request, runId }, "profile");
  });
});
