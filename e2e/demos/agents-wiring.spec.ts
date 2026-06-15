// # coverage: full-page tour of the agent NEW form's WIRING sections
// (/intelligence/agents/new) — the steps that wire an agent to its capabilities:
// Tools, Model, Qualities, Rubrics, Instructions, and the system Prompt. It
// scrolls top->bottom through EVERY rendered GenericForm step section (Basic
// Information → Tools → Model → Qualities → Rubrics → Instructions → Prompt
// Instructions), holding ~1s on each so its title + controls read, then exercises
// the live affordances of the wiring steps: types into the Tools step search box
// (pressSequentially so the typing shows, lets the grid re-filter, then clears),
// opens the Tools Filter popover (its "Show selected" checkbox) and dismisses it
// with Escape, types into the Model step search box and clears it, and reveals
// the Model picker grid's selectable options (hover only — never clicked).
//
// Every beat past the ONE page-ready assertion (the GenericForm root) is guarded
// (isVisible().catch / scrollToText no-ops on an absent target) and strictly
// NON-DESTRUCTIVE: nothing is submitted (the "Create Agent" button is never
// clicked), no model/tool/rubric is selected (only revealed + hovered), search
// boxes are typed-then-cleared, and the Filter popover is open-then-Escape — no
// filter is ever applied. After landing on the form we settleLoaded() so the
// populated form, not a loading skeleton, opens the clip.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-wiring";

// The step sections the agent form renders, top->bottom. The model-capability
// steps (temperature/reasoning/voice) only mount once a model is picked — which
// we deliberately do NOT do (non-destructive) — so they're absent here and the
// scroll for them no-ops. Each entry is { stepId, heading } so we can scroll the
// section's title into frame and hold on it. The wiring steps (tools/model/
// qualities/rubrics/instructions/prompt) are the focus of this demo.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "tools", heading: /^tools$/i },
  { stepId: "model", heading: /^model$/i },
  { stepId: "qualities", heading: /^qualities$/i },
  { stepId: "rubrics", heading: /^rubrics$/i },
  { stepId: "instructions", heading: /^instructions$/i },
  { stepId: "prompt", heading: /prompt instructions/i },
];

test.describe("demo: agents wiring", () => {
  test("tours the agent wiring sections — tools, model, rubrics, prompt", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — scroll top->bottom through EVERY rendered step section, holding
    // ~1s on each so its title + controls read. Each scroll is a guarded no-op
    // for a section that isn't mounted (e.g. the model-capability steps, which
    // only appear once a model is picked — and we don't pick one).
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_000);
      }
    }

    // BEAT 2 — exercise the Tools step search box. Each wiring step carries a
    // StepCard search input ("Search tools...") that filters the tool grid live.
    // Type into it (pressSequentially so the keystrokes show), let the grid
    // re-filter, then CLEAR it (non-destructive: search is a view filter, never
    // a mutation). Guarded so an absent step/input is a clean no-op.
    const toolsStep = page.getByTestId("artifact-form-step-tools").first();
    if (await toolsStep.isVisible().catch(() => false)) {
      await toolsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(700);
      const toolSearch = toolsStep.getByPlaceholder(/search tools/i).first();
      if (await toolSearch.isVisible().catch(() => false)) {
        await toolSearch.click().catch(() => undefined);
        await toolSearch.pressSequentially("search", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
        await toolSearch.fill("").catch(() => undefined);
        await pauseForDemo(700);
      }

      // BEAT 3 — open the Tools step Filter popover (the funnel icon) to reveal
      // its "Show selected" toggle, hold so it reads, then dismiss with Escape
      // WITHOUT applying (the popover only commits on its "Apply" button, which
      // we never click — fully reversible, no filter applied).
      const filterButton = toolsStep.getByRole("button").filter({ has: page.locator("svg") });
      const funnel = filterButton.last();
      if (await funnel.isVisible().catch(() => false)) {
        await funnel.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await scrollToText(page, /show selected/i);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // BEAT 4 — exercise the Model step search box + reveal the model picker grid.
    // Type into "Search models..." so the grid narrows, hold, then clear it.
    // Then reveal the picker grid's selectable options and HOVER the first one —
    // never clicked, so no model is selected (which would mutate the draft and
    // spawn the capability steps). Guarded throughout.
    const modelStep = page.getByTestId("artifact-form-step-model").first();
    if (await modelStep.isVisible().catch(() => false)) {
      await modelStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /^model$/i);
      const modelSearch = modelStep.getByPlaceholder(/search models/i).first();
      if (await modelSearch.isVisible().catch(() => false)) {
        await modelSearch.click().catch(() => undefined);
        await modelSearch.pressSequentially("gpt", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
        await modelSearch.fill("").catch(() => undefined);
        await pauseForDemo(700);
      }

      const modelGrid = modelStep.getByTestId("picker-models").first();
      if (await modelGrid.isVisible().catch(() => false)) {
        await modelGrid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
        const firstModel = modelGrid.getByTestId("selectable-option").first();
        if (await firstModel.isVisible().catch(() => false)) {
          await firstModel.hover().catch(() => undefined);
          await pauseForDemo(1_100);
        }
      }
    }

    // BEAT 5 — hold on the rubrics + prompt wiring sections to close on the
    // capability-wiring story (what this agent is graded on + how it behaves).
    for (const heading of [/^rubrics$/i, /prompt instructions/i]) {
      const target = page.getByText(heading).first();
      if (await target.isVisible().catch(() => false)) {
        await target.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(1_000);
      }
    }

    // End held at the top of the form (Basic Information) so the clip closes on a
    // stable, populated frame rather than mid-scroll.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basic information/i);
      await pauseForDemo(1_100);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
