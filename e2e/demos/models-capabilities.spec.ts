import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: models capabilities", () => {
  test("enable modalities and pick a capability", async ({ models, page }) => {
    test.setTimeout(120_000);
    await models.form.openNew();
    await models.form.fill("name", "Aurora Multimodal");
    await models.form.toggleFlag("model_modalities_enabled"); // reveal the Modalities section
    await models.form.multiSelectFirst("modalities"); // pick a capability if any exist
    await saveDemoVideo(page, "models-capabilities");
  });
});
