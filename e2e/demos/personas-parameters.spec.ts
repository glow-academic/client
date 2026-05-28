import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: personas parameters", () => {
  test("attach a parameter field to a persona", async ({ personas, page }) => {
    test.setTimeout(120_000);
    await personas.form.openNew();
    await personas.form.fill("name", "Parameterized Student");
    await personas.form.expandSelectFirst("parameters"); // open a group → pick a field
    await saveDemoVideo(page, "personas-parameters");
  });
});
