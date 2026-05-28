import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: providers create", () => {
  test("instructor builds a provider", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "provider", {
      name: `Acme AI ${runId}`,
      value: `acme-${runId}`,
      description: "Hosted inference provider for tutoring models.",
      endpoint: "https://api.acme.example/v1",
    });
  });
});
