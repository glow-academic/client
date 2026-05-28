import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: profiles create", () => {
  test("instructor builds a profile", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "profile", {
      name: `Jordan Lee ${runId}`,
    });
  });
});
