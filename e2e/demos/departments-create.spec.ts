import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: departments create", () => {
  test("instructor builds a department", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "department", {
      name: `Customer Success ${runId}`,
      description: "Team responsible for onboarding and account health.",
    });
  });
});
