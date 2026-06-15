// TOPIC: departments-draft
// # coverage: DRAFT-WORKFLOW tour of the new-department form
// (/platform/departments/new) — modeled on rubrics-draft / personas-draft.
// Distinct from departments-bulk / departments-search (which tour the library
// grid): this clip CENTERS on the SaveToolbar draft workflow. It opens /new,
// settles the form, types a name so autosave ANCHORS a draft (draftId in the
// URL), then opens the Drafts picker (draft-picker-trigger) to reveal the
// saved-drafts list, types into the in-dropdown search (pressSequentially so the
// typing shows) to filter then CLEARS it, hovers the first draft entry to
// surface it, and reveals the Autosave toggle (draft-autosave-toggle) WITHOUT
// flipping it — then Escape. A brief top->bottom scroll through the form's step
// sections (Basic Information → Settings) closes the tour with context.
//
// HARD RULES honored: NON-DESTRUCTIVE only — the picker is opened-then-Escaped,
// no draft is switched into, nothing is submitted ("Create"/submit never
// clicked), and the autosave toggle is only revealed, never flipped. Every beat
// past the SINGLE page-ready assertion (artifact-form) is guarded
// (isVisible().catch / bounded waitFor) so an absent affordance — an empty draft
// list, an unmounted section — is a clean no-op. settleLoaded() runs before any
// tour beat so no loading skeleton is captured.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "departments-draft";
const NEW_PATH = "/platform/departments/new";
const NAME_PLACEHOLDER = /customer success/i;

// The step sections the department form renders, top->bottom. Each entry is
// { stepId, heading } so we can scroll the section's title into frame and hold.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information/i },
  { stepId: "settings", heading: /^settings$/i },
];

/** True if the locator becomes visible within a short, bounded window. */
async function visibleSoon(locator: Locator, timeout = 4_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: departments draft", () => {
  test("tours the department draft workflow in the SaveToolbar", async ({ page }) => {
    test.setTimeout(180_000);

    // ── Open the new-department page ─────────────────────────────────────────
    await page.goto(NEW_PATH);
    await expectAuthenticated(page);

    // SINGLE real page-ready assertion: the GenericForm root. Keep exactly one.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton so the LOADED form — not the shimmer — opens the
    // clip, then hold a beat on the rendered form.
    await settleLoaded(page);
    await pauseForDemo(700);

    // ── Anchor a draft via autosave ──────────────────────────────────────────
    // Type a name into the Basic step's name input — the first change triggers
    // the draft autosave, which writes ``?draftId=…`` to the URL and (once the
    // save flushes) flips the SaveToolbar from "Save Draft" to the Drafts
    // picker. Guarded: if the input isn't present we simply skip ahead.
    const nameInput = page.getByPlaceholder(NAME_PLACEHOLDER).first();
    if (await visibleSoon(nameInput)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Draft Department Demo", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(800);

      // Wait (deterministically) for the draft to anchor — draftId in the URL —
      // then for the "Saving…/Save Draft" indicator to clear so the toolbar
      // settles on the Drafts dropdown. Both bounded so a non-anchoring form
      // gives up fast instead of hanging the clip.
      await page.waitForURL(/[?&]draftId=/, { timeout: 8_000 }).catch(() => undefined);
      await page
        .getByRole("button", { name: /saving|save draft/i })
        .first()
        .waitFor({ state: "detached", timeout: 8_000 })
        .catch(() => undefined);
      await pauseForDemo(700);
    }

    // ── CENTER: the Drafts picker (open → list → search → hover → autosave) ───
    // BEAT 1 — open the SaveToolbar "Drafts picker" dropdown to reveal the
    // saved-drafts list + its search box. The picker trigger only renders once
    // there are no unsaved changes, so it's guarded; the dropdown shows even
    // when the draft list is empty ("No drafts available").
    const draftTrigger = page.getByTestId("draft-picker-trigger");
    if (await visibleSoon(draftTrigger, 6_000)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200); // let the dropdown open + lazy-load the drafts list

      // BEAT 2 — reveal the saved-drafts list (each entry: draft-menu-item-{id}).
      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await visibleSoon(firstDraft, 5_000)) {
        await pauseForDemo(900); // hold so the list reads
      }

      // BEAT 3 — type into the in-dropdown search (pressSequentially so the
      // typing shows) to visibly filter the saved-drafts list, hold so the
      // debounced filter reacts, then CLEAR it so the full list returns.
      // Read-only — never commits anything. Guarded.
      const draftSearch = page.getByTestId("draft-search");
      if (await visibleSoon(draftSearch, 3_000)) {
        await draftSearch.click().catch(() => undefined);
        await draftSearch.pressSequentially("department", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(800);
      }

      // BEAT 4 — hover the first saved-draft entry so the row surfaces on frame.
      // NON-DESTRUCTIVE: hover only — no click → no draft switch. Guarded so an
      // empty draft list is a clean no-op.
      if (await firstDraft.isVisible().catch(() => false)) {
        await firstDraft.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }

      // BEAT 5 — reveal the Autosave toggle in the dropdown footer so the
      // draft-autosave control registers on frame. We only hover it — never
      // flip it (NON-DESTRUCTIVE: leaves the autosave preference untouched).
      const autosaveToggle = page.getByTestId("draft-autosave-toggle");
      if (await visibleSoon(autosaveToggle, 3_000)) {
        await autosaveToggle.scrollIntoViewIfNeeded().catch(() => undefined);
        await autosaveToggle.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }

      // Dismiss the picker with Escape WITHOUT selecting a draft (reversible,
      // nothing committed). Guarded.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // ── Brief context scroll: tour the department form's step sections ───────
    // top->bottom, holding ~1s on each so its title reads. Each scroll is a
    // guarded no-op for a section that isn't mounted.
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_100);
      }
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
