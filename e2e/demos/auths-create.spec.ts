import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: auths create", () => {
  test("instructor builds an auth", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "auth", {
      name: `Production API Key ${runId}`,
      description: "Credentials for the production inference gateway.",
    });
  });
});
