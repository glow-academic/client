import { expect, test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-tuning";

// coverage: tour the full agent-builder form top->bottom — basic info, the
// Tools and Model step searches (type/react/clear), pick a model to reveal the
// conditional tuning steps (Temperature / Reasoning / Voice), then hold on the
// Qualities / Rubrics / Instructions / Prompt steps and the submit row. Every
// beat past the one page-ready assertion is guarded so a step the live data
// doesn't render is skipped cleanly. Strictly non-destructive: searches are
// typed then cleared, a read-only model pick reveals capability steps, and the
// form is never submitted.
test.describe("demo: agents tuning", () => {
  test("tours the agent builder: search, model pick, and tuning sections", async ({
    page,
  }) => {
    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    // Page-ready: the multi-step builder form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // The opening step: name + description + departments. Hold so it reads.
    await holdStep(page, "basic", /^Basic Information$/i);

    // ── Tools ─────────────────────────────────────────────────────────
    // Scroll the Tools step on camera and exercise its search box: type so
    // the filtering shows, let it react, then clear it (non-mutating).
    await holdStep(page, "tools", /^Tools$/i);
    await demoSearch(page, "tools", "Search tools...", "code");

    // ── Model ─────────────────────────────────────────────────────────
    // Same for the Model step's search, then pick the first model. Selecting
    // a model is what GATES the conditional tuning steps below into the DOM
    // (Agent.tsx → selectedModelCapabilities), so this is the load-bearing
    // beat that lets the rest of the tour have anything to show.
    await holdStep(page, "model", /^Model$/i);
    await demoSearch(page, "model", "Search models...", "gpt");

    const modelStep = page.getByTestId("artifact-form-step-model");
    const firstModel = modelStep.getByTestId("selectable-option").first();
    if (await firstModel.isVisible().catch(() => false)) {
      await firstModel.click().catch(() => undefined);
      // Let the capability steps mount before we scroll to them.
      await pauseForDemo(1200);
    }

    // ── Tuning sections (conditional on the selected model) ───────────
    // Temperature always shows once a model is picked; Reasoning needs text
    // output and Voice needs audio in+out, so they may be absent — holdStep
    // no-ops on any step that isn't in the DOM.
    await holdStep(page, "temperature", /^Temperature$/i);
    await holdStep(page, "reasoning", /^Reasoning Effort$/i);
    await holdStep(page, "voice", /^Voices?$/i);

    // ── Qualities / Rubrics / Instructions / Prompt ───────────────────
    // The tail of the form. Each is optional and guarded.
    await holdStep(page, "qualities", /^Qualities$/i);
    await holdStep(page, "rubrics", /^Rubrics$/i);
    await holdStep(page, "instructions", /^Instructions$/i);
    await holdStep(page, "prompt", /^Prompt Instructions$/i);

    // ── Submit row ────────────────────────────────────────────────────
    // Scroll the action bar into view to close the tour — never clicked, so
    // nothing is created.
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1000);
    }

    await saveDemoVideo(page, TOPIC);
  });
});

/**
 * Scroll a form step into view and hold the camera there, but only if the step
 * actually rendered. Conditional steps (e.g. Reasoning/Voice depend on the
 * selected model's modalities) are absent from the DOM, so this no-ops cleanly
 * rather than failing. Reuses scrollToText's scroll+pause and adds an explicit
 * hold so the section is unmistakably on camera.
 */
async function holdStep(
  page: Page,
  stepId: string,
  heading: RegExp,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await scrollToText(page, heading);
  await pauseForDemo(1200);
}

/**
 * Exercise a step's read-only search box: focus it, type a query character by
 * character so the typing is visible, let the list re-filter, then clear it so
 * no state is committed. Guarded on both the step and the input being present.
 */
async function demoSearch(
  page: Page,
  stepId: string,
  placeholder: string,
  query: string,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const search = step.getByPlaceholder(placeholder).first();
  if (!(await search.isVisible().catch(() => false))) return;
  await search.scrollIntoViewIfNeeded().catch(() => undefined);
  await search.click().catch(() => undefined);
  await search.pressSequentially(query, { delay: 55 }).catch(() => undefined);
  // Let the grid re-filter on the typed query.
  await pauseForDemo(1100);
  // Clear it so the demo leaves the form untouched.
  await search.fill("").catch(() => undefined);
  await pauseForDemo(700);
}
