// # coverage: DRAFT-WORKFLOW tour of the simulation NEW form
// (/training/simulations/new), CENTERED on the Drafts picker (the SaveToolbar).
// Opens /new, settles past the loading skeleton, then drives the draft picker
// as the heart of the clip: opens the "Drafts picker" trigger to reveal the
// saved-drafts list, types into its "Search drafts…" box (pressSequentially so
// the typing shows) and CLEARS it so the list re-expands, hovers the first
// listed draft, and reveals the Autosave toggle in the dropdown footer —
// dismissing with Escape WITHOUT switching to / committing any draft. It then
// scrolls briefly top->bottom through the form's step sections (Basic
// Information → Scenarios), holding ~1s on each so its title reads. Every beat
// past the ONE page-ready assertion is guarded (isVisible().catch / scrollToText
// no-ops on an absent target) and strictly NON-DESTRUCTIVE: nothing is submitted
// (the form's "Create Simulation" button is never clicked), no draft is selected
// or created, the autosave switch is only revealed (never toggled), and the
// picker is open-then-Escape.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "simulations-draft";

// The step sections the simulation form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's title into frame and hold.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "scenarios", heading: /^scenarios$/i },
];

test.describe("demo: simulations draft", () => {
  test("tours the simulation drafts picker and new-form sections", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/training/simulations/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type into the simulation Name field so the typing shows on camera
    // (pressSequentially with a delay). Authoring a name is the heart of a
    // "draft": autosave would anchor a draft from it. Guarded so an absent field
    // is a clean no-op. NON-DESTRUCTIVE: we leave the text but never submit.
    const nameInput = page.getByPlaceholder(/simulation name/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Draft: De-escalation Sim", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 (CENTERPIECE) — open the Drafts picker dropdown (the SaveToolbar
    // "Drafts picker" trigger) to reveal the saved-drafts list + its search box.
    // Guarded throughout; the whole block no-ops if the trigger is absent.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      // Hold so the open dropdown — its list of saved drafts — reads on frame.
      await pauseForDemo(1_300);

      // BEAT 2a — type into the "Search drafts…" box so the list visibly
      // narrows (pressSequentially so the keystrokes show), hold, then CLEAR it
      // so the full list re-expands. Read-only: typing only filters the view.
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.click().catch(() => undefined);
        await draftSearch.pressSequentially("sim", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 2b — hover the first listed draft so a saved-draft row registers on
      // frame. HOVER ONLY — no click, so no draft is switched to (which would
      // navigate + replace the in-progress form). Guarded for an empty list.
      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await firstDraft.isVisible().catch(() => false)) {
        await firstDraft.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }

      // BEAT 2c — reveal the Autosave toggle in the dropdown footer so the
      // draft-workflow control reads. REVEAL ONLY — we scroll/hold on it but
      // never flip the switch (toggling autosave is a real preference mutation).
      const autosaveToggle = page.getByTestId("draft-autosave-toggle").first();
      if (await autosaveToggle.isVisible().catch(() => false)) {
        await autosaveToggle.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // Dismiss the picker WITHOUT selecting/creating a draft (reversible).
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 3 — brief scroll top->bottom through the form's step sections,
    // holding ~1s on each so its title reads. Each scroll is a guarded no-op for
    // a section that isn't mounted. NON-DESTRUCTIVE: view-only scrolling.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
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
