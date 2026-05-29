import { test } from "../fixtures";
import { genDemo } from "../helpers/crud-demos";
test.describe("demo: generation events", () => {
  test("a live AI generation streaming its events", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(150_000);
    await genDemo({ page, demo, registry, request, runId }, "generation-events",
      "Draft a concise, friendly onboarding persona for a first-year student.");
  });
});
