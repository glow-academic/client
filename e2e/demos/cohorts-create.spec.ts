// # coverage: full-page tour of the cohort NEW form (/training/cohorts/new) —
// types into the cohort Name field (pressSequentially so the typing shows) and
// the Description, then scrolls top->bottom through EVERY step section the
// GenericForm renders (Basic Information → Simulations → Profiles), holding ~1s
// on each so its title + controls read. Within Basic it reveals the inline
// Departments selectable-grid (hover a card, no click → no selection mutated)
// and the Flags row; within Simulations it types into the step search box (so
// the list visibly re-queries) then clears it, and opens the "Show selected"
// filter then resets it; finally it opens the Drafts picker (open → type into
// its search → Escape, no draft committed). Every beat past the one page-ready
// assertion is guarded (isVisible().catch / scrollToText no-ops on an absent
// target) and strictly NON-DESTRUCTIVE: nothing is submitted — the form's
// "Create Cohort" button is never clicked, departments/simulations/profiles are
// only revealed (not selected), and the Drafts picker is open-then-Escape.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-create";

// The step sections the cohort form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's title into frame and hold.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "simulations", heading: /^simulations$/i },
  { stepId: "profiles", heading: /^profiles$/i },
];

test.describe("demo: cohorts create", () => {
  test("tours the cohort new-form sections, pickers, and the drafts picker", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/training/cohorts/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the cohort Name field so the typing shows on camera
    // (pressSequentially with a delay). Authoring a name is the heart of a new
    // cohort: autosave anchors a draft from it. Guarded so an absent field is a
    // clean no-op.
    const nameInput = page.getByPlaceholder(/spring 2024 cohort/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Spring Intake", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 — fill the Description so the Basic Information section reads as a
    // real, in-progress draft. Typed (pressSequentially) so it shows. Guarded.
    const descInput = page.getByTestId("input-cohort-description").first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput
        .pressSequentially("First-year students in the spring intake, paired with intro simulations.", {
          delay: 16,
        })
        .catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 3 — within Basic, reveal the inline Departments selectable-grid: bring
    // it into frame and hover its first card so the selectable options register.
    // NON-DESTRUCTIVE — hover only, never a click (no department selected, no
    // draft mutation). Guarded so an empty/absent catalog no-ops.
    const basicStep = page.getByTestId("artifact-form-step-basic").first();
    if (await basicStep.isVisible().catch(() => false)) {
      await scrollToText(page, /departments/i);
      const deptCard = basicStep.getByTestId("selectable-option").first();
      if (await deptCard.isVisible().catch(() => false)) {
        await deptCard.scrollIntoViewIfNeeded().catch(() => undefined);
        await deptCard.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }
      // The Flags row (e.g. active status) rounds out the Basic section.
      await scrollToText(page, /flags/i);
      await pauseForDemo(800);
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

    // BEAT 5 — exercise the Simulations step search box so the list visibly
    // re-queries: type a token (pressSequentially so the typing shows), let it
    // react, then clear it back to the full list. Read-only; nothing selected.
    const simStep = page.getByTestId("artifact-form-step-simulations").first();
    if (await simStep.isVisible().catch(() => false)) {
      await simStep.scrollIntoViewIfNeeded().catch(() => undefined);
      const simSearch = simStep.getByPlaceholder(/search simulations/i).first();
      if (await simSearch.isVisible().catch(() => false)) {
        await simSearch.click().catch(() => undefined);
        await simSearch.pressSequentially("intro", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_300);
        await simSearch.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 6 — toggle the step's "Show selected" view-filter on to show it
      // re-scopes the list, hold, then toggle it back off — reversible, no
      // committed change. Guarded so an absent filter no-ops.
      const showSelected = simStep.getByText(/show selected/i).first();
      if (await showSelected.isVisible().catch(() => false)) {
        await showSelected.scrollIntoViewIfNeeded().catch(() => undefined);
        await showSelected.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await showSelected.click().catch(() => undefined);
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
      const draftSearch = page.getByPlaceholder(/search drafts/i).first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.pressSequentially("cohort", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
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
