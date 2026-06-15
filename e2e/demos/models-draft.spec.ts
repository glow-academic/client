// # coverage: DRAFT-WORKFLOW tour of the model NEW form (/intelligence/models/new),
// centered on the Drafts picker in the SaveToolbar — distinct from models-create
// (which submits): this demo NEVER submits and NEVER switches drafts. It types a
// model name (pressSequentially so the typing shows) to anchor an in-progress
// draft, then CENTERS on the Drafts picker: open the dropdown → reveal the saved
// drafts list → type into its search so the list visibly narrows → clear it →
// hover the first draft row → reveal the Autosave toggle in the footer, then
// dismiss with Escape WITHOUT selecting/switching a draft. It closes with a brief
// top->bottom scroll through the form's rendered step sections so the page reads
// as a real authoring surface. Every beat past the ONE page-ready assertion is
// guarded (isVisible().catch / scrollToText no-ops on an absent target) and
// strictly NON-DESTRUCTIVE: nothing is submitted, no draft is selected/switched,
// the Autosave toggle is only revealed (never clicked), and the picker is
// open-then-Escape.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-draft";

// The model form's step sections, top->bottom (GenericForm step ids from
// components/artifacts/model/Model.tsx). On a fresh /new only "basic" is mounted;
// the advanced sections are gated behind feature flags + a picked provider —
// which this demo deliberately does NOT do — so their scrolls no-op cleanly.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "provider", heading: /^provider$/i },
  { stepId: "modalities", heading: /^modalities$/i },
  { stepId: "temperature", heading: /^temperature$/i },
  { stepId: "pricing", heading: /^pricing$/i },
  { stepId: "reasoning", heading: /reasoning levels/i },
  { stepId: "voices", heading: /^voices$/i },
  { stepId: "qualities", heading: /^qualities$/i },
];

test.describe("demo: models draft", () => {
  test("tours the model drafts picker (open, search, autosave reveal, escape)", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/intelligence/models/new");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out any loading skeleton so the populated form — not the shimmer —
    // opens the clip, then hold a beat on the rendered form.
    await settleLoaded(page);

    // BEAT 1 — type a model name (pressSequentially so the typing shows on
    // camera). Authoring a name is what anchors a draft, so this sets up the
    // Drafts-picker story below. Guarded so an absent field is a clean no-op.
    const nameInput = page.getByPlaceholder(/^e\.g\., gpt-4$/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Draft Model gpt-4o-demo", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // BEAT 2 (CENTERPIECE) — open the Drafts picker dropdown (SaveToolbar's
    // "Drafts picker" trigger) to reveal the list of saved drafts.
    // NON-DESTRUCTIVE: open only — no draft is selected/switched.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_300);

      // BEAT 3 — type into the dropdown's "Search drafts…" box so the saved-
      // drafts list visibly narrows (debounced re-query), hold so it reads,
      // then CLEAR it so the full list returns. Reversible, nothing committed.
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.click().catch(() => undefined);
        await draftSearch.pressSequentially("model", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_300);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(1_000);
      }

      // BEAT 4 — hover the first saved-draft row so a selectable draft entry
      // registers on frame. HOVER only — no click → no draft switch. Guarded so
      // an empty drafts list (no rows) is a clean no-op.
      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await firstDraft.isVisible().catch(() => false)) {
        await firstDraft.hover().catch(() => undefined);
        await pauseForDemo(1_200);
      }

      // BEAT 5 — reveal the footer's Autosave toggle so the draft-workflow
      // control reads on camera. REVEAL only — we scroll/hover it but NEVER
      // click it (toggling autosave would mutate persisted draft behavior).
      const autosaveToggle = page.getByTestId("draft-autosave-toggle").first();
      if (await autosaveToggle.isVisible().catch(() => false)) {
        await autosaveToggle.scrollIntoViewIfNeeded().catch(() => undefined);
        await autosaveToggle.hover().catch(() => undefined);
        await pauseForDemo(1_300);
      }

      // Dismiss the picker WITHOUT selecting/switching a draft.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 6 — brief form-step scroll top->bottom so the authoring surface reads
    // as a real, in-progress draft. Each scroll is a guarded no-op for a section
    // that isn't mounted (the advanced sections, gated behind flags + a picked
    // provider we never set, are absent — their scrolls no-op).
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_000);
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
