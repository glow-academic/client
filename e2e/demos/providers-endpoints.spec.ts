import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: providers endpoints", () => {
  test("configure a provider endpoint URL", async ({ providers, page }) => {
    test.setTimeout(120_000);
    await providers.form.openNew();
    await providers.form.fill("name", "Acme Inference");
    await providers.form.fillIfPresent("endpoint", "https://api.acme.example/v1");
    await saveDemoVideo(page, "providers-endpoints");
  });
});
