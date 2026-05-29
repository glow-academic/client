import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: media overview", () => {
  test("attach a file and image to a document", async ({ documents, page }) => {
    test.setTimeout(120_000);
    await documents.form.openNew();
    await documents.form.fill("name", "Course Handout");
    await documents.form.uploadFile("uploads", "e2e/fixtures/sample.txt");
    await documents.form.uploadFile("images", "e2e/fixtures/sample.png");
    await saveDemoVideo(page, "media-overview");
  });
});
