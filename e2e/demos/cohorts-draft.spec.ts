// # coverage: NON-DESTRUCTIVE form-tour of the cohort create/DRAFT form
// (/training/cohorts/new) framed around the draft workflow. After the one
// page-ready assertion (the GenericForm `artifact-form` root) and settleLoaded
// (so the populated form, not the loading skeleton, opens the clip) it: types
// into the cohort Name (pressSequentially so the typing shows) and Description
// to seed an in-progress draft; scrolls top->bottom through EVERY rendered step
// section (Basic Information → Simulations → Profiles), holding ~1s on each so
// its title + controls read; within Basic reveals the inline Departments
// selectable-grid (hover only — no card clicked, no selection mutated); exercises
// the Simulations step search box (type → list re-queries → clear) and toggles
// its "Show selected" view-filter on then back off (reversible); exercises the
// Profiles (member) step the same way (search type+clear, Show-selected on/off);
// then features the DRAFT affordances on the SaveToolbar — opens the Drafts
// picker, types into its search so the saved-draft list narrows, reveals the
// Autosave toggle row, and dismisses with Escape WITHOUT switching/committing a
// draft or flipping autosave. Every beat past the page-ready assertion is guarded
// (isVisible().catch / scrollToText no-ops on an absent target) and strictly
// NON-DESTRUCTIVE: nothing is submitted (Create Cohort never clicked), no
// department/simulation/profile is selected, the draft picker is open-then-Escape,
// and the autosave switch is only revealed, never toggled. TOPIC: cohorts-draft.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "cohorts-draft";

// The step sections the cohort form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's title into frame and hold.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "simulations", heading: /^simulations$/i },
  { stepId: "profiles", heading: /^profiles$/i },
];

test.describe("demo: cohorts draft", () => {
  test("tours the cohort draft form, member/simulation pickers, and the drafts picker", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto("/training/cohorts/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the cohort Name field so the typing shows on camera
    // (pressSequentially with a delay). Naming the cohort is what anchors an
    // autosaved draft, so it leads the draft-workflow tour. Guarded so an absent
    // field is a clean no-op.
    const nameInput = page.getByPlaceholder(/spring 2024 cohort/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Spring Intake Draft", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 — fill the Description so the Basic Information section reads as a
    // real, in-progress draft. Typed (pressSequentially) so it shows. Guarded.
    const descInput = page.getByTestId("input-cohort-description").first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput
        .pressSequentially("Draft cohort: first-year spring intake, paired with intro simulations.", {
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
    // react, then clear it back to the full list. Then toggle the step's
    // "Show selected" view-filter on (re-scopes the list), hold, and toggle it
    // back off — reversible, nothing selected/committed. Guarded throughout.
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
      const simShowSelected = simStep.getByText(/show selected/i).first();
      if (await simShowSelected.isVisible().catch(() => false)) {
        await simShowSelected.scrollIntoViewIfNeeded().catch(() => undefined);
        await simShowSelected.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await simShowSelected.click().catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // BEAT 6 — exercise the Profiles (member) picker the same way: type into its
    // search so the member list visibly re-queries, clear it, then toggle its
    // "Show selected" view-filter on then back off. Read-only; no member added to
    // the draft. Guarded so an absent member catalog no-ops.
    const profStep = page.getByTestId("artifact-form-step-profiles").first();
    if (await profStep.isVisible().catch(() => false)) {
      await profStep.scrollIntoViewIfNeeded().catch(() => undefined);
      const profSearch = profStep.getByPlaceholder(/search profiles/i).first();
      if (await profSearch.isVisible().catch(() => false)) {
        await profSearch.click().catch(() => undefined);
        await profSearch.pressSequentially("student", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_300);
        await profSearch.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }
      const profShowSelected = profStep.getByText(/show selected/i).first();
      if (await profShowSelected.isVisible().catch(() => false)) {
        await profShowSelected.scrollIntoViewIfNeeded().catch(() => undefined);
        await profShowSelected.click().catch(() => undefined);
        await pauseForDemo(1_100);
        await profShowSelected.click().catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // BEAT 7 — feature the DRAFT affordances on the SaveToolbar: open the Drafts
    // picker dropdown to reveal the saved-draft list + its search, type into the
    // search so the list visibly narrows, reveal the Autosave toggle row (the
    // mechanism that persists this in-progress cohort as a draft), then dismiss
    // with Escape WITHOUT switching/committing a draft or flipping autosave —
    // reversible, nothing committed. Guarded throughout.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.pressSequentially("cohort", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(700);
      }
      // Reveal the Autosave toggle row — read-only, never flipped.
      const autosaveToggle = page.getByTestId("draft-autosave-toggle").first();
      if (await autosaveToggle.isVisible().catch(() => false)) {
        await autosaveToggle.hover().catch(() => undefined);
        await pauseForDemo(1_100);
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
