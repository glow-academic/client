// # coverage: full-page tour of the agent NEW form (/intelligence/agents/new) —
// types into the agent Name field (pressSequentially so the typing shows) and
// the Description, then scrolls top->bottom through EVERY step section that the
// GenericForm renders (Basic Information → Tools → Model → Qualities → Rubrics →
// Instructions → Prompt Instructions), holding ~1s on each so its title +
// controls read, reveals the Model picker grid, and opens the Drafts picker
// (open → type into its search → Escape, no draft committed). Every beat past
// the one page-ready assertion is guarded (isVisible().catch / scrollToText
// no-ops on an absent target) and strictly non-destructive: nothing is
// submitted — the form's "Create Agent" button is never clicked, the model is
// only revealed (not selected), and the Drafts picker is open-then-Escape.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "agents-draft";

// The step sections the agent form renders, top->bottom. The model-capability
// steps (temperature/reasoning/voice) only mount once a model is picked — which
// we deliberately do NOT do (non-destructive) — so they're absent here and the
// scrollToText for them no-ops. Each entry is { stepId, heading } so we can
// scroll the section's title into frame and confirm/hold on it.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "tools", heading: /^tools$/i },
  { stepId: "model", heading: /^model$/i },
  { stepId: "qualities", heading: /^qualities$/i },
  { stepId: "rubrics", heading: /^rubrics$/i },
  { stepId: "instructions", heading: /^instructions$/i },
  { stepId: "prompt", heading: /prompt instructions/i },
];

test.describe("demo: agents draft", () => {
  test("tours the agent new-form sections and the drafts picker", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/intelligence/agents/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the agent Name field so the typing shows on camera
    // (pressSequentially with a delay). Authoring a name is the heart of a
    // "draft": autosave anchors a draft from it. Guarded so an absent field is
    // a clean no-op.
    const nameInput = page.getByPlaceholder(/customer support agent/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Tier-1 Support Agent", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 — fill the Description so the Basic Information section reads as a
    // real, in-progress draft. Typed (pressSequentially) so it shows. Guarded.
    const descInput = page.getByTestId("input-agent-description").first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput
        .pressSequentially("Greets the customer, identifies the issue, and resolves or escalates.", {
          delay: 18,
        })
        .catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 3 — scroll top->bottom through EVERY rendered step section, holding
    // ~1s on each so its title + controls read. Each scroll is a guarded no-op
    // for a section that isn't mounted (e.g. the model-capability steps, which
    // only appear once a model is picked — and we don't pick one).
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        // Bring the section heading into clear frame, then hold.
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
    }

    // BEAT 4 — reveal the Model picker grid so the selectable model options
    // register on frame. NON-DESTRUCTIVE: we only bring the picker into view and
    // hover its first option (no click → no model selected, no draft mutation,
    // no conditional steps spawned). Guarded so an empty/absent catalog is a
    // clean no-op.
    const modelGrid = page.getByTestId("picker-models").first();
    if (await modelGrid.isVisible().catch(() => false)) {
      await modelGrid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      const firstModel = modelGrid.getByTestId("selectable-option").first();
      if (await firstModel.isVisible().catch(() => false)) {
        await firstModel.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }
    }

    // BEAT 5 — open the Drafts picker dropdown (the SaveToolbar "Drafts picker"
    // trigger) to reveal the list of saved drafts + its search box, type into
    // the search so the list visibly narrows, then dismiss with Escape WITHOUT
    // selecting a draft (reversible, nothing committed). Guarded throughout.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      // The dropdown carries a "Search drafts..." input — type to narrow.
      const draftSearch = page.getByPlaceholder(/search drafts/i).first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.pressSequentially("agent", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // End held on the top of the populated form (Basic Information) so the clip
    // closes on substantive, in-progress draft content.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basic information/i);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
