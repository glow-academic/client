// # coverage: full-page tour of the field NEW form (/management/fields/new) —
// types into the field Name (pressSequentially so the typing shows) and the
// Description, then scrolls top->bottom through EVERY GenericForm step section
// (Basic Information → Conditional Parameters), holding ~1s on each so its title
// + controls read. Within Basic it reveals the inline Departments selectable
// grid (hover the first card, no click → no selection mutated) and the Flags
// row; within Conditional Parameters it types into the step search box (so the
// list visibly re-queries) then clears it, and opens the "Show selected" filter
// popover then dismisses it (Escape) with nothing toggled. Finally it opens the
// Drafts picker (open → type into its search → Escape, no draft committed) and
// scrolls the submit/back row into frame WITHOUT clicking it. Every beat past
// the one page-ready assertion is guarded (isVisible().catch / scrollToText
// no-ops on an absent target) and strictly NON-DESTRUCTIVE: nothing is
// submitted — the "Create Field" button is never clicked, departments/flags/
// conditional parameters are only revealed (not selected), the filter popover
// and Drafts picker are open-then-Escape.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "fields-create";

// The step sections the field form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's title into frame and hold.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "conditional", heading: /conditional parameters/i },
];

test.describe("demo: fields create", () => {
  test("tours the field new-form sections, pickers, and the drafts picker", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/management/fields/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the field Name so the typing shows on camera
    // (pressSequentially with a delay). Naming the field is the heart of a new
    // field: autosave anchors a draft from it. Guarded so an absent field is a
    // clean no-op.
    const nameInput = page.getByPlaceholder(/e\.g\., learning style/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Learning Style", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 — fill the Description so the Basic Information section reads as a
    // real, in-progress draft. Typed (pressSequentially) so it shows. Guarded.
    const descInput = page.getByPlaceholder(/brief description/i).first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput
        .pressSequentially("How the learner prefers to absorb material.", { delay: 18 })
        .catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 3 — within Basic, reveal the inline Departments selectable grid: bring
    // it into frame and hover its first card so the selectable options register.
    // NON-DESTRUCTIVE — hover only, never a click (no department selected, no
    // draft mutation). Then bring the Flags row into frame to round out Basic.
    // Guarded so an empty/absent catalog no-ops.
    const basicStep = page.getByTestId("artifact-form-step-basic").first();
    if (await basicStep.isVisible().catch(() => false)) {
      await scrollToText(page, /departments/i);
      const deptCard = basicStep.getByTestId("selectable-option").first();
      if (await deptCard.isVisible().catch(() => false)) {
        await deptCard.scrollIntoViewIfNeeded().catch(() => undefined);
        await deptCard.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await scrollToText(page, /flags/i);
      await pauseForDemo(900);
    }

    // BEAT 4 — scroll top->bottom through EVERY rendered step section, holding
    // ~1s on each so its title + controls read. Each scroll is a guarded no-op
    // for a section that isn't mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
    }

    // BEAT 5 — exercise the Conditional Parameters step search box so the list
    // visibly re-queries: type a token (pressSequentially so the typing shows),
    // let it react, then clear it back to the full list. Read-only; nothing
    // selected. Guarded so an absent step/search no-ops.
    const condStep = page.getByTestId("artifact-form-step-conditional").first();
    if (await condStep.isVisible().catch(() => false)) {
      await condStep.scrollIntoViewIfNeeded().catch(() => undefined);
      const condSearch = condStep.getByPlaceholder(/search conditional parameters/i).first();
      if (await condSearch.isVisible().catch(() => false)) {
        await condSearch.click().catch(() => undefined);
        await condSearch.pressSequentially("level", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_300);
        await condSearch.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 6 — open the step's Filters popover to reveal the "Show selected"
      // view-filter, hold so it reads, then dismiss with Escape WITHOUT toggling
      // it (reversible, nothing committed). The trigger is the Filter icon button
      // in the step's search row. Guarded so an absent filter no-ops.
      const filterTrigger = condStep.locator("button:has(> svg.lucide-filter)").first();
      if (await filterTrigger.isVisible().catch(() => false)) {
        await filterTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await filterTrigger.click().catch(() => undefined);
        await pauseForDemo(1_200);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // BEAT 7 — open the Drafts picker dropdown (the SaveToolbar trigger) to
    // reveal the list of saved drafts + its search box, type into the search so
    // the list visibly narrows, then dismiss with Escape WITHOUT selecting a
    // draft (reversible, nothing committed). Guarded throughout.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.pressSequentially("field", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 8 — scroll the submit/back row into frame so the form's footer reads,
    // but NEVER click it. NON-DESTRUCTIVE: the "Create Field" button is only
    // revealed, never invoked. Guarded so an absent footer no-ops.
    const submitRow = page.getByTestId("artifact-form-submit").first();
    if (await submitRow.isVisible().catch(() => false)) {
      await submitRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // End held on the top of the populated form (Basic Information) so the clip
    // closes on substantive, in-progress draft content.
    if (await basicStep.isVisible().catch(() => false)) {
      await basicStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basic information/i);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
