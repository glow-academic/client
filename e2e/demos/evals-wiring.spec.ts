// # coverage: full-page tour of the eval NEW form's WIRING sections
// (/platform/evals/new) — the steps that wire an eval to what it grades and
// how. The eval GenericForm renders exactly two step sections, top->bottom:
// Basics (name / description / flags / departments) and Models (the wiring
// step: the Models picker + Model Flags + Model Positions + Model Rubrics).
// This demo scrolls top->bottom through every rendered step section, holding
// ~1s on each so its title + controls read, then exercises the live, READ-ONLY
// affordances of the Models wiring step: types into the "Search models..." box
// (pressSequentially so the keystrokes show) and clears it, opens the StepCard
// Filter popover (its "Show selected only" checkbox) and dismisses it with
// Escape WITHOUT applying, and reveals the Models + Model Rubrics picker grids'
// selectable options (hover only — never clicked). It scrolls the submit row
// (Back / Create Eval) into frame to close the wiring story, then NEVER submits.
//
// Every beat past the ONE page-ready assertion (the GenericForm root,
// data-testid="artifact-form") is guarded — isVisible().catch / scrollToText
// no-op on an absent target — and strictly NON-DESTRUCTIVE: nothing is
// submitted (the "Create Eval" button is never clicked), no model/rubric is
// selected (only revealed + hovered), the search box is typed-then-cleared, and
// the Filter popover is open-then-Escape so no filter is ever applied. After
// landing on the form we settleLoaded() so the populated form — not a loading
// skeleton — opens the clip.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "evals-wiring";

// The step sections the eval form renders, top->bottom. The eval GenericForm
// has exactly two steps — "basic" (Basics) and "models" (the wiring step). Each
// entry is { stepId, heading } so we can scroll the section's title into frame
// and hold on it. A scroll for a section that is somehow absent no-ops cleanly.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basics/i },
  { stepId: "models", heading: /^models$/i },
];

test.describe("demo: evals wiring", () => {
  test("tours the eval wiring sections — models, flags, positions, rubrics", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/platform/evals/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — scroll top->bottom through every rendered step section, holding
    // ~1s on each so its title + controls read. Guarded no-op for any section
    // not mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_000);
      }
    }

    // BEAT 2 — hold on the Basics section's sub-sections (Flags + Departments)
    // so the "what this eval is + who owns it" wiring reads before we move to
    // the models step. Each scroll is a guarded no-op on an absent label.
    for (const heading of [/^flags$/i, /departments/i]) {
      await scrollToText(page, heading);
      await pauseForDemo(900);
    }

    // BEAT 3 — exercise the Models wiring step's StepCard search box. It carries
    // a "Search models..." input that filters the model grid live. Type into it
    // (pressSequentially so the keystrokes show), let the grid re-filter, then
    // CLEAR it (non-destructive: search is a view filter, never a mutation).
    // Guarded so an absent step/input is a clean no-op.
    const modelsStep = page.getByTestId("artifact-form-step-models").first();
    if (await modelsStep.isVisible().catch(() => false)) {
      await modelsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
      const modelSearch = modelsStep.getByPlaceholder(/search models/i).first();
      if (await modelSearch.isVisible().catch(() => false)) {
        await modelSearch.click().catch(() => undefined);
        await modelSearch.pressSequentially("gpt", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
        await modelSearch.fill("").catch(() => undefined);
        await pauseForDemo(700);
      }

      // BEAT 4 — open the Models step Filter popover (the funnel icon) to reveal
      // its "Show selected only" toggle, hold so it reads, then dismiss with
      // Escape WITHOUT applying (the popover only commits on its "Apply" button,
      // which we never click — fully reversible, no filter applied).
      const funnel = modelsStep.getByRole("button").filter({ has: page.locator("svg") }).last();
      if (await funnel.isVisible().catch(() => false)) {
        await funnel.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await scrollToText(page, /show selected only/i);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }

      // BEAT 5 — reveal the Models picker grid's selectable options and HOVER
      // the first one — never clicked, so no model is selected (which would
      // mutate the draft). Guarded throughout.
      const modelGrid = modelsStep.getByTestId("picker-models").first();
      if (await modelGrid.isVisible().catch(() => false)) {
        await modelGrid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
        const firstModel = modelGrid.getByTestId("selectable-option").first();
        if (await firstModel.isVisible().catch(() => false)) {
          await firstModel.hover().catch(() => undefined);
          await pauseForDemo(1_100);
        }
      }

      // BEAT 6 — reveal the Model Rubrics picker (what each model is graded on —
      // the heart of the eval wiring). Scroll it into frame, hold, and hover its
      // first selectable option WITHOUT clicking (a rubric pick would mutate the
      // draft). Guarded.
      const rubricsGrid = modelsStep.getByTestId("picker-model-rubrics").first();
      if (await rubricsGrid.isVisible().catch(() => false)) {
        await rubricsGrid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(1_000);
        const firstRubric = rubricsGrid.getByTestId("selectable-option").first();
        if (await firstRubric.isVisible().catch(() => false)) {
          await firstRubric.hover().catch(() => undefined);
          await pauseForDemo(1_100);
        }
      }
    }

    // BEAT 7 — scroll the submit row (Back / Create Eval) into frame so the
    // form's commit affordance reads — but NEVER click it (non-destructive: the
    // eval is never created). Guarded on the submit button's testid.
    const submitRow = page.getByTestId("artifact-form-submit").first();
    if (await submitRow.isVisible().catch(() => false)) {
      await submitRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // End held at the top of the form (Basics) so the clip closes on a stable,
    // populated frame rather than mid-scroll.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basics/i);
      await pauseForDemo(1_100);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
