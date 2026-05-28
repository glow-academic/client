import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: tools args", () => {
  test("define a tool argument", async ({ tools, page }) => {
    test.setTimeout(120_000);
    await tools.form.openNew();
    await tools.form.fill("name", "Calculator");
    await tools.form.addArgument("operand"); // Add Argument → name it (field_type defaults to string)
    await saveDemoVideo(page, "tools-args");
  });
});
