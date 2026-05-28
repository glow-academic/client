import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: personas examples", () => {
  test("add example dialogue that teaches voice", async ({ personas, page }) => {
    test.setTimeout(120_000);
    await personas.form.openNew();
    await personas.form.fill("name", "Voiced Student");
    await personas.form.fillIfPresent(
      "example",
      "Wait, sorry — could you explain that last step again? I'm a bit lost.",
    );
    await saveDemoVideo(page, "personas-examples");
  });
});
