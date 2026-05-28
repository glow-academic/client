import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: rubrics points", () => {
  test("set the rubric pass-points threshold", async ({ rubrics, page }) => {
    test.setTimeout(120_000);
    await rubrics.form.openNew();
    await rubrics.form.fill("name", "Discovery Call Rubric");
    await rubrics.form.fillIfPresent("passPoints", "12");
    await saveDemoVideo(page, "rubrics-points");
  });
});
