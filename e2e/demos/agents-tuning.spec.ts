import { expect, test, type Page } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-tuning";

test.describe("demo: agents tuning", () => {
  test("records temperature, reasoning, and voice tuning sections", async ({ page }) => {
    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    await expect(page.getByTestId("input-agent-description")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    // The Temperature / Reasoning / Voice steps are CONDITIONAL: they only
    // render once a model is selected (Agent.tsx → `selectedModelCapabilities`
    // gates the config steps on `draftState.modelId`). On the bare /new form
    // they aren't in the DOM at all, so the camera previously just sat at the
    // top with nothing to scroll to. Pick a model first to reveal them, then
    // hold the viewport on each section so it's actually on camera.
    const modelStep = page.getByTestId("artifact-form-step-model");
    await modelStep.scrollIntoViewIfNeeded().catch(() => undefined);
    await scrollToText(page, /^Model$/i);
    const firstModel = modelStep.getByTestId("selectable-option").first();
    if (await firstModel.isVisible().catch(() => false)) {
      await firstModel.click().catch(() => undefined);
      // Let the model selection settle so the capability steps mount.
      await pauseForDemo(1200);
    }

    // Visit each tuning section the selected model exposes, holding the camera
    // on each. `holdOn` scrolls the section into view and pauses ONLY when it's
    // actually rendered — so a model that doesn't expose a capability (e.g.
    // Reasoning needs text output, Voice needs audio in+out) is skipped cleanly
    // instead of failing. NOTE (real app bug, flagged in PR): the client derives
    // these capabilities from `input_modalities`/`output_modalities`, which the
    // model payload doesn't carry (it only has `modality_ids`), so Reasoning and
    // Voice currently never render for any model. The demo shows what's real.
    for (const [stepId, heading] of [
      ["temperature", /^Temperature$/i],
      ["reasoning", /^Reasoning Effort$/i],
      ["voice", /^Voices?$/i],
    ] as const) {
      await holdOn(page, stepId, heading);
    }

    await saveDemoVideo(page, TOPIC);
  });
});

/** Scroll a tuning step into view and hold the camera there, but only if the
 *  step actually rendered. Reuses scrollToText's scroll+pause and adds an
 *  explicit hold so the section is unmistakably on camera. */
async function holdOn(page: Page, stepId: string, heading: RegExp): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await scrollToText(page, heading);
  await pauseForDemo(1200);
}
