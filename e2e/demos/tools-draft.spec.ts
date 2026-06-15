// # coverage: tools-draft — DRAFT-WORKFLOW tour of the tool NEW form
// (/intelligence/tools/new), centered on the Drafts picker in the SaveToolbar
// (components/common/drafts/SaveToolbar.tsx). Distinct from tools-create (which
// tours the form steps): this clip authors a name so autosave anchors an
// in-progress draft, then OPENS the Drafts picker dropdown and dwells on it —
// reveals the saved-drafts list, types into its "Search drafts…" box so the
// list visibly narrows (then CLEARS it), hovers the first draft row, and
// reveals the Autosave toggle in the footer — before Escape-dismissing the
// dropdown WITHOUT selecting/switching a draft. It closes with a brief
// top->bottom scroll of the form sections (Basic / Arguments / Permissions).
//
// Strictly NON-DESTRUCTIVE against the LIVE instance: it never submits (the
// "Create" button is never clicked), never switches drafts (the picker is
// open→search→clear→hover→Escape), and never toggles the persisted Autosave
// Switch (only reveals/hovers it). Every beat past the single page-ready
// assertion is guarded (isVisible().catch(() => false) / scrollToText no-ops on
// an absent target) so a missing affordance is a clean no-op, not a failure.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tools-draft";

// The tool form's step sections, top->bottom. Instructions only mounts once
// resources resolve, so its scroll no-ops cleanly if absent.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "arguments", heading: /^arguments$/i },
  { stepId: "permissions", heading: /^permissions$/i },
];

test.describe("demo: tools draft", () => {
  test("tours the tool draft workflow and the drafts picker", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/intelligence/tools/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out the loading skeleton so the populated form — not the shimmer —
    // opens the clip.
    await settleLoaded(page);

    // BEAT 1 — author a tool Name so autosave anchors an in-progress draft
    // (this is the heart of the "draft" workflow). Typed with pressSequentially
    // so the keystrokes show. Guarded so an absent field is a clean no-op.
    const nameInput = page.getByPlaceholder(/e\.g\., Calculator/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Weather Lookup", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 — OPEN the Drafts picker dropdown (the SaveToolbar trigger). This
    // is the center of the clip: dwell so the saved-drafts list reads.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_400);

      // BEAT 3 — type into the "Search drafts…" box so the list visibly
      // narrows / re-queries, hold for the reaction, then CLEAR it back to the
      // full list (read-only filter — nothing committed). Guarded.
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.click().catch(() => undefined);
        await draftSearch.pressSequentially("tool", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }

      // BEAT 4 — hover the first draft row to surface it as a switch target,
      // WITHOUT clicking (a click would switch drafts — out of scope). Guarded
      // so an empty drafts list is a clean no-op.
      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await firstDraft.isVisible().catch(() => false)) {
        await firstDraft.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }

      // BEAT 5 — reveal the Autosave toggle in the dropdown footer (this is the
      // control that makes drafting hands-free). NON-DESTRUCTIVE: we only
      // scroll/hover it — never click — since the Switch persists a setting.
      const autosaveToggle = page.getByTestId("draft-autosave-toggle").first();
      if (await autosaveToggle.isVisible().catch(() => false)) {
        await autosaveToggle.scrollIntoViewIfNeeded().catch(() => undefined);
        await autosaveToggle.hover().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // Dismiss the picker WITHOUT selecting a draft (reversible, nothing
      // committed).
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 6 — brief top->bottom scroll of the form sections so the clip shows
    // WHAT a draft captures (Basic / Arguments / Permissions), ~1s on each.
    // Each scroll is a guarded no-op for a section that isn't mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
    }

    // Close held on the top of the populated form so the clip ends on the
    // in-progress draft content.
    const top = page.getByTestId("artifact-form-step-basic").first();
    if (await top.isVisible().catch(() => false)) {
      await top.scrollIntoViewIfNeeded().catch(() => undefined);
      await scrollToText(page, /basic information/i);
      await pauseForDemo(1_200);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
