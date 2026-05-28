import { test } from "../fixtures";
import { createDemo } from "../helpers/crud-demos";

test.describe("demo: documents create", () => {
  test("instructor builds a document", async ({ page, demo, registry, request, runId }) => {
    test.setTimeout(180_000);
    await createDemo({ page, demo, registry, request, runId }, "document", {
      name: `Course Syllabus ${runId}`,
      description: "Syllabus and reference material for the course.",
      text: "Week 1: Introduction and course overview.",
    });
  });
});
