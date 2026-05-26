// Provider — demo story (paced, recorded).

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: providers", () => {
  test("instructor builds a provider", async ({ providers, runId, page }) => {
    const name = `Acme AI ${runId}`;

    await providers.create({
      name,
      value: `acme-${runId}`,
      description: "Hosted inference provider for tutoring models.",
      endpoint: "https://api.acme.example/v1",
    });

    await providers.open();
    await providers.search(name);
    await providers.library.expectVisible(name);

    await saveDemoVideo(page, "providers-create-story");
  });
});
