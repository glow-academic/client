// # coverage: DRAFT-WORKFLOW tour of the new-profile form
// (/management/profiles/new) — distinct from profiles-create (which tours the
// form fields step-by-step). After the form settles (no skeleton frame), this
// clip CENTERS on the SaveToolbar draft workflow: it opens the "Drafts picker"
// trigger to reveal the saved-drafts list + its search box, types into the
// draft-search (pressSequentially so the typing shows) to filter the list then
// clears it, hovers a saved-draft entry to surface it, and reveals the autosave
// toggle (draft-autosave-toggle) WITHOUT flipping it — then Escape. A brief
// top->bottom scroll through the form's step sections (Basic Information →
// Contact Information → Roles, where the role avatar cards live) gives context.
// Every beat past the one page-ready assertion (artifact-form) is guarded
// (isVisible().catch / scrollToText no-ops on an absent target), so an empty
// draft list (picker still shows "No drafts available") or an unmounted section
// is a clean no-op. Strictly NON-DESTRUCTIVE: nothing is submitted (the "Create
// Profile" button is never clicked), no draft is switched into (Escape only),
// and the autosave toggle is only revealed, never flipped.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-draft";

// The step sections the profile form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's title into frame and hold.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "contact", heading: /contact information/i },
  { stepId: "roles", heading: /^roles$/i },
];

test.describe("demo: profiles draft", () => {
  test("tours the profile draft workflow in the SaveToolbar", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/management/profiles/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — open the SaveToolbar "Drafts picker" dropdown to reveal the
    // saved-drafts list + its search box. This is the heart of the draft
    // workflow. Guarded so an absent trigger is a clean no-op. The dropdown
    // shows even when the draft list is empty ("No drafts available").
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_300);

      // BEAT 2 — type into the draft search (pressSequentially so the typing
      // shows) to visibly filter the saved-drafts list, hold so it reacts,
      // then clear so the full list returns. Guarded.
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.click().catch(() => undefined);
        await draftSearch.pressSequentially("profile", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_300);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 3 — hover the first saved-draft entry so an entry surfaces on
      // frame. NON-DESTRUCTIVE: hover only — no click → no draft switch.
      // Guarded so an empty draft list is a clean no-op.
      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await firstDraft.isVisible().catch(() => false)) {
        await firstDraft.hover().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // BEAT 4 — reveal the autosave toggle at the foot of the dropdown so the
      // draft-autosave control registers on frame. We only hover it — never
      // flip it (NON-DESTRUCTIVE: leaves the autosave preference untouched).
      const autosaveToggle = page.getByTestId("draft-autosave-toggle").first();
      if (await autosaveToggle.isVisible().catch(() => false)) {
        await autosaveToggle.scrollIntoViewIfNeeded().catch(() => undefined);
        await autosaveToggle.hover().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // Dismiss the dropdown with Escape WITHOUT selecting a draft (reversible,
      // nothing committed). Guarded.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 5 — brief context scroll top->bottom through the profile form's step
    // sections, holding ~1s on each so its title reads. Each scroll is a guarded
    // no-op for a section that isn't mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
    }

    // BEAT 6 — on the Roles step, hover the first role avatar card so the
    // selectable role affordance reads on frame. NON-DESTRUCTIVE: hover only —
    // no click → no role is selected. Guarded so an absent card is a clean no-op.
    const roleCard = page.getByTestId("selectable-option").first();
    if (await roleCard.isVisible().catch(() => false)) {
      await roleCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await roleCard.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // End held back at the top of the form (Basic Information) so the clip
    // closes on the draft's substantive content.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basic information/i);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
